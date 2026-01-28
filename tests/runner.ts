import http from 'http';
import {
  TestSpec,
  TestContext,
  TestResult,
  TestSuiteResult,
  RequestSpec,
  StressTestResults,
  TestCategory,
} from './types';
import { specs } from './specs/index';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Parse command line arguments
function parseArgs(): { categories: TestCategory[]; verbose: boolean } {
  const args = process.argv.slice(2);
  const categories: TestCategory[] = [];
  let verbose = false;

  for (const arg of args) {
    if (arg === '--functional') categories.push('functional');
    if (arg === '--boundary') categories.push('boundary');
    if (arg === '--stress') categories.push('stress');
    if (arg === '--verbose' || arg === '-v') verbose = true;
  }

  // Default: run all categories
  if (categories.length === 0) {
    categories.push('functional', 'boundary', 'stress');
  }

  return { categories, verbose };
}

// HTTP request helper
async function makeRequest(
  ctx: TestContext,
  reqSpec: RequestSpec
): Promise<{ status: number; body: unknown; responseTime: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Build URL with query params
    let path = reqSpec.path;
    if (reqSpec.query) {
      const params = new URLSearchParams(reqSpec.query);
      path += `?${params.toString()}`;
    }

    // Replace placeholders in path with context values
    path = replacePlaceholders(path, ctx);

    const url = new URL(path, ctx.baseUrl);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: reqSpec.method,
      headers: {
        'Content-Type': 'application/json',
        ...replacePlaceholdersInHeaders(reqSpec.headers || {}, ctx),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        let body: unknown;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode || 0, body, responseTime });
      });
    });

    req.on('error', reject);

    if (reqSpec.body) {
      const bodyStr = JSON.stringify(replacePlaceholdersInBody(reqSpec.body, ctx));
      req.write(bodyStr);
    }

    req.end();
  });
}

// Replace {{placeholder}} with context values
function replacePlaceholders(str: string, ctx: TestContext): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === 'idempotencyKey') {
      return `test-key-${Date.now()}-${ctx.idempotencyCounter++}`;
    }
    return String(ctx.savedValues[key] ?? `{{${key}}}`);
  });
}

function replacePlaceholdersInHeaders(
  headers: Record<string, string>,
  ctx: TestContext
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = replacePlaceholders(value, ctx);
  }
  return result;
}

function replacePlaceholdersInBody(body: unknown, ctx: TestContext): unknown {
  if (typeof body === 'string') {
    return replacePlaceholders(body, ctx);
  }
  if (Array.isArray(body)) {
    return body.map((item) => replacePlaceholdersInBody(item, ctx));
  }
  if (body && typeof body === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      result[key] = replacePlaceholdersInBody(value, ctx);
    }
    return result;
  }
  return body;
}

// Check if actual body contains expected values
function bodyContainsExpected(actual: unknown, expected: Record<string, unknown>): boolean {
  if (!actual || typeof actual !== 'object') return false;
  const actualObj = actual as Record<string, unknown>;

  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actualObj)) return false;
    if (typeof value === 'object' && value !== null) {
      if (!bodyContainsExpected(actualObj[key], value as Record<string, unknown>)) {
        return false;
      }
    } else if (actualObj[key] !== value) {
      return false;
    }
  }
  return true;
}

// Run a single test spec
async function runTest(spec: TestSpec, ctx: TestContext): Promise<TestResult> {
  if (spec.skip) {
    return { spec, passed: true, error: 'SKIPPED' };
  }

  try {
    // Run setup actions
    if (spec.setup) {
      for (const action of spec.setup) {
        if (action.type === 'request' && action.request) {
          const response = await makeRequest(ctx, action.request);
          if (action.saveAs) {
            ctx.savedValues[action.saveAs] = response.body;
            // Extract common values like IDs
            if (typeof response.body === 'object' && response.body) {
              const bodyObj = response.body as Record<string, unknown>;
              if (bodyObj.data && typeof bodyObj.data === 'object') {
                const data = bodyObj.data as Record<string, unknown>;
                if (data.id) {
                  ctx.savedValues[`${action.saveAs}Id`] = data.id;
                }
              }
            }
          }
        }
      }
    }

    // Handle stress tests differently
    if (spec.category === 'stress' && spec.stressConfig) {
      return await runStressTest(spec, ctx);
    }

    // Make the actual request
    const { status, body, responseTime } = await makeRequest(ctx, spec.request);

    // Validate response
    const expected = spec.expected;
    let passed = true;
    let error: string | undefined;

    if (expected.status !== undefined && status !== expected.status) {
      passed = false;
      error = `Expected status ${expected.status}, got ${status}`;
    }

    if (expected.statusRange) {
      if (status < expected.statusRange.min || status > expected.statusRange.max) {
        passed = false;
        error = `Expected status in range ${expected.statusRange.min}-${expected.statusRange.max}, got ${status}`;
      }
    }

    if (expected.bodyContains && !bodyContainsExpected(body, expected.bodyContains)) {
      passed = false;
      error = `Response body does not contain expected values`;
    }

    if (expected.bodyMatches && !expected.bodyMatches(body)) {
      passed = false;
      error = `Response body does not match custom validator`;
    }

    // Run cleanup actions
    if (spec.cleanup) {
      for (const action of spec.cleanup) {
        if (action.type === 'request' && action.request) {
          await makeRequest(ctx, action.request);
        }
      }
    }

    return { spec, passed, error, responseTime, actualStatus: status, actualBody: body };
  } catch (err) {
    return {
      spec,
      passed: false,
      error: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Run stress test
async function runStressTest(spec: TestSpec, ctx: TestContext): Promise<TestResult> {
  const config = spec.stressConfig!;
  const results: { success: boolean; responseTime: number }[] = [];

  const runBatch = async (batchSize: number): Promise<void> => {
    const promises = Array(batchSize)
      .fill(null)
      .map(async () => {
        try {
          const { status, responseTime } = await makeRequest(ctx, spec.request);
          const success =
            spec.expected.status !== undefined
              ? status === spec.expected.status
              : status >= 200 && status < 300;
          results.push({ success, responseTime });
        } catch {
          results.push({ success: false, responseTime: 0 });
        }
      });
    await Promise.all(promises);
  };

  // Run requests in batches
  let remaining = config.totalRequests;
  while (remaining > 0) {
    const batchSize = Math.min(remaining, config.concurrentRequests);
    await runBatch(batchSize);
    remaining -= batchSize;
  }

  // Calculate metrics
  const successful = results.filter((r) => r.success).length;
  const responseTimes = results.filter((r) => r.success).map((r) => r.responseTime);
  const stressResults: StressTestResults = {
    totalRequests: config.totalRequests,
    successfulRequests: successful,
    failedRequests: config.totalRequests - successful,
    avgResponseTime: responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0,
    minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    successRate: successful / config.totalRequests,
  };

  const passed =
    stressResults.successRate >= config.expectedSuccessRate &&
    (config.maxResponseTimeMs === undefined ||
      stressResults.maxResponseTime <= config.maxResponseTimeMs);

  return {
    spec,
    passed,
    stressResults,
    error: passed
      ? undefined
      : `Success rate: ${(stressResults.successRate * 100).toFixed(1)}% (expected ${config.expectedSuccessRate * 100}%)`,
  };
}

// Run test suite
async function runTestSuite(categories: TestCategory[], verbose: boolean): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const ctx: TestContext = {
    baseUrl: BASE_URL,
    savedValues: {},
    idempotencyCounter: 0,
  };

  // Filter specs by category
  const filteredSpecs = specs.filter((s) => categories.includes(s.category));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Car Park Reservation API Test Suite`);
  console.log(`  Categories: ${categories.join(', ')}`);
  console.log(`  Total specs: ${filteredSpecs.length}`);
  console.log(`${'='.repeat(60)}\n`);

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const spec of filteredSpecs) {
    process.stdout.write(`  [${spec.category.toUpperCase().padEnd(10)}] ${spec.name}... `);

    const result = await runTest(spec, ctx);
    results.push(result);

    if (result.error === 'SKIPPED') {
      console.log('\x1b[33mSKIPPED\x1b[0m');
      skipped++;
    } else if (result.passed) {
      console.log(`\x1b[32mPASS\x1b[0m${result.responseTime ? ` (${result.responseTime}ms)` : ''}`);
      passed++;
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m`);
      failed++;
      if (verbose || result.error) {
        console.log(`    Error: ${result.error}`);
        if (verbose && result.actualStatus) {
          console.log(`    Status: ${result.actualStatus}`);
        }
      }
    }

    // Print stress test details
    if (result.stressResults) {
      const sr = result.stressResults;
      console.log(`    Requests: ${sr.totalRequests} | Success: ${sr.successfulRequests} | Failed: ${sr.failedRequests}`);
      console.log(`    Avg: ${sr.avgResponseTime.toFixed(0)}ms | Min: ${sr.minResponseTime}ms | Max: ${sr.maxResponseTime}ms`);
    }
  }

  const duration = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`${'='.repeat(60)}\n`);

  return { total: filteredSpecs.length, passed, failed, skipped, duration, results };
}

// Main
async function main(): Promise<void> {
  const { categories, verbose } = parseArgs();

  console.log(`\nConnecting to ${BASE_URL}...`);

  // Check if server is running
  try {
    await makeRequest(
      { baseUrl: BASE_URL, savedValues: {}, idempotencyCounter: 0 },
      { method: 'GET', path: '/health' }
    );
  } catch (err) {
    console.error(`\n\x1b[31mError: Cannot connect to server at ${BASE_URL}\x1b[0m`);
    console.error('Make sure the server is running with: npm start\n');
    process.exit(1);
  }

  const result = await runTestSuite(categories, verbose);
  process.exit(result.failed > 0 ? 1 : 0);
}

main();
