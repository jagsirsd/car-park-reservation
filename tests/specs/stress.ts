import { TestSpec } from '../types';

// Helper to generate timestamps
const futureDate = (hoursFromNow: number): string => {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return date.toISOString();
};

export const stressSpecs: TestSpec[] = [
  // ============================================
  // READ ENDPOINT STRESS TESTS
  // ============================================
  {
    id: 'stress-availability-concurrent-reads',
    name: 'Stress: Concurrent availability queries',
    description: 'Multiple concurrent requests to availability endpoint',
    category: 'stress',
    tags: ['availability', 'concurrent', 'read'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
    },
    expected: {
      status: 200,
    },
    stressConfig: {
      concurrentRequests: 10,
      totalRequests: 50,
      expectedSuccessRate: 0.95,
      maxResponseTimeMs: 5000,
    },
  },

  {
    id: 'stress-health-endpoint',
    name: 'Stress: Health check under load',
    description: 'Health endpoint should remain responsive under load',
    category: 'stress',
    tags: ['health', 'concurrent'],
    request: {
      method: 'GET',
      path: '/health',
    },
    expected: {
      status: 200,
    },
    stressConfig: {
      concurrentRequests: 20,
      totalRequests: 100,
      expectedSuccessRate: 0.99,
      maxResponseTimeMs: 2000,
    },
  },

  {
    id: 'stress-availability-with-filters',
    name: 'Stress: Filtered availability queries',
    description: 'Concurrent filtered availability requests',
    category: 'stress',
    tags: ['availability', 'filter', 'concurrent'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: { floor: '1' },
    },
    expected: {
      status: 200,
    },
    stressConfig: {
      concurrentRequests: 10,
      totalRequests: 30,
      expectedSuccessRate: 0.95,
      maxResponseTimeMs: 3000,
    },
  },

  // ============================================
  // WRITE ENDPOINT STRESS TESTS
  // ============================================
  {
    id: 'stress-reservation-sequential',
    name: 'Stress: Sequential reservation creation',
    description: 'Multiple reservations created in sequence',
    category: 'stress',
    tags: ['reservation', 'write', 'sequential'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 9,
        customerName: 'Stress Test User',
        customerEmail: 'stress@test.com',
        startTime: futureDate(1000),
        endTime: futureDate(1001),
      },
    },
    expected: {
      // First will succeed (201), rest will fail (409) due to overlap
      statusRange: { min: 200, max: 500 },
    },
    stressConfig: {
      concurrentRequests: 1, // Sequential
      totalRequests: 10,
      expectedSuccessRate: 0.1, // Only first should succeed
      maxResponseTimeMs: 5000,
    },
  },

  // ============================================
  // IDEMPOTENCY STRESS TESTS
  // ============================================
  {
    id: 'stress-idempotency-same-key',
    name: 'Stress: Same idempotency key repeated',
    description: 'Same request with same key should always return same response',
    category: 'stress',
    tags: ['idempotency', 'concurrent'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': 'stress-test-fixed-key-001' },
      body: {
        spotId: 10,
        customerName: 'Idempotency Stress',
        customerEmail: 'idem-stress@test.com',
        startTime: futureDate(1100),
        endTime: futureDate(1102),
      },
    },
    expected: {
      status: 201,
    },
    stressConfig: {
      concurrentRequests: 5,
      totalRequests: 20,
      expectedSuccessRate: 0.95, // All should get same cached response
      maxResponseTimeMs: 3000,
    },
  },

  // ============================================
  // MIXED WORKLOAD STRESS TESTS
  // ============================================
  {
    id: 'stress-get-reservation-not-found',
    name: 'Stress: 404 responses under load',
    description: 'Server handles many 404 responses gracefully',
    category: 'stress',
    tags: ['reservation', 'read', 'error'],
    request: {
      method: 'GET',
      path: '/api/carpark/reservations/99999',
    },
    expected: {
      status: 404,
    },
    stressConfig: {
      concurrentRequests: 10,
      totalRequests: 30,
      expectedSuccessRate: 0.95,
      maxResponseTimeMs: 3000,
    },
  },

  {
    id: 'stress-validation-errors',
    name: 'Stress: Validation error handling',
    description: 'Server handles many validation errors gracefully',
    category: 'stress',
    tags: ['validation', 'error'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: -1, // Invalid
        customerName: '',
        customerEmail: 'invalid',
        startTime: 'bad-date',
        endTime: 'bad-date',
      },
    },
    expected: {
      status: 400,
    },
    stressConfig: {
      concurrentRequests: 10,
      totalRequests: 30,
      expectedSuccessRate: 0.95,
      maxResponseTimeMs: 3000,
    },
  },

  // ============================================
  // DATABASE STRESS TESTS
  // ============================================
  {
    id: 'stress-availability-time-range',
    name: 'Stress: Time-range queries',
    description: 'Complex queries with time range filtering',
    category: 'stress',
    tags: ['availability', 'query', 'database'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: {
        floor: '1',
        start_time: futureDate(100),
        end_time: futureDate(200),
      },
    },
    expected: {
      status: 200,
    },
    stressConfig: {
      concurrentRequests: 5,
      totalRequests: 20,
      expectedSuccessRate: 0.95,
      maxResponseTimeMs: 5000,
    },
  },

  // ============================================
  // BURST TRAFFIC SIMULATION
  // ============================================
  {
    id: 'stress-burst-traffic-read',
    name: 'Stress: Burst traffic on read endpoints',
    description: 'Simulates sudden spike in read traffic',
    category: 'stress',
    tags: ['burst', 'read'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
    },
    expected: {
      status: 200,
    },
    stressConfig: {
      concurrentRequests: 25,
      totalRequests: 50,
      expectedSuccessRate: 0.90,
      maxResponseTimeMs: 10000,
    },
  },
];
