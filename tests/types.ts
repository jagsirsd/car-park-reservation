// Test spec types for the Car Park Reservation API

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type TestCategory = 'functional' | 'boundary' | 'stress';

export interface RequestSpec {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface ExpectedResponse {
  status?: number;
  statusRange?: { min: number; max: number };
  bodyContains?: Record<string, unknown>;
  bodyMatches?: (body: unknown) => boolean;
  headerContains?: Record<string, string>;
}

export interface TestSpec {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  tags?: string[];

  // Setup: run before this test
  setup?: SetupAction[];

  // The actual request
  request: RequestSpec;

  // Expected response
  expected: ExpectedResponse;

  // Cleanup: run after this test
  cleanup?: CleanupAction[];

  // For stress tests
  stressConfig?: StressConfig;

  // Dependencies: test IDs that must pass before this test
  dependsOn?: string[];

  // Skip this test
  skip?: boolean;
}

export interface SetupAction {
  type: 'request' | 'resetDb';
  request?: RequestSpec;
  saveAs?: string; // Save response to context with this key
}

export interface CleanupAction {
  type: 'request' | 'resetDb';
  request?: RequestSpec;
}

export interface StressConfig {
  concurrentRequests: number;
  totalRequests: number;
  expectedSuccessRate: number; // 0-1
  maxResponseTimeMs?: number;
}

export interface TestContext {
  baseUrl: string;
  savedValues: Record<string, unknown>;
  idempotencyCounter: number;
}

export interface TestResult {
  spec: TestSpec;
  passed: boolean;
  error?: string;
  responseTime?: number;
  actualStatus?: number;
  actualBody?: unknown;
  stressResults?: StressTestResults;
}

export interface StressTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
}
