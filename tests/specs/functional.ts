import { TestSpec } from '../types';

// Helper to generate future timestamps
const futureDate = (hoursFromNow: number): string => {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return date.toISOString();
};

export const functionalSpecs: TestSpec[] = [
  // ============================================
  // HEALTH CHECK
  // ============================================
  {
    id: 'health-check',
    name: 'Health endpoint returns OK',
    description: 'Verify the health check endpoint is working',
    category: 'functional',
    tags: ['health', 'smoke'],
    request: {
      method: 'GET',
      path: '/health',
    },
    expected: {
      status: 200,
      bodyContains: { status: 'ok' },
    },
  },

  // ============================================
  // AVAILABILITY QUERIES
  // ============================================
  {
    id: 'get-all-availability',
    name: 'Get all available parking spots',
    description: 'Query availability without filters should return all spots',
    category: 'functional',
    tags: ['availability', 'query'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
    },
    expected: {
      status: 200,
      bodyContains: { success: true },
      bodyMatches: (body) => {
        const b = body as { data?: unknown[] };
        return Array.isArray(b.data) && b.data.length > 0;
      },
    },
  },

  {
    id: 'get-availability-by-floor',
    name: 'Get availability filtered by floor',
    description: 'Query availability for a specific floor',
    category: 'functional',
    tags: ['availability', 'query', 'filter'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: { floor: '1' },
    },
    expected: {
      status: 200,
      bodyContains: { success: true },
      bodyMatches: (body) => {
        const b = body as { data?: Array<{ floor: number }> };
        return Array.isArray(b.data) && b.data.every((spot) => spot.floor === 1);
      },
    },
  },

  {
    id: 'get-availability-with-time-range',
    name: 'Get availability with time range filter',
    description: 'Query availability for a specific time range',
    category: 'functional',
    tags: ['availability', 'query', 'filter', 'time'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: {
        start_time: futureDate(24),
        end_time: futureDate(26),
      },
    },
    expected: {
      status: 200,
      bodyContains: { success: true },
    },
  },

  // ============================================
  // RESERVATION CREATION
  // ============================================
  {
    id: 'create-reservation-success',
    name: 'Create a new reservation',
    description: 'Successfully create a parking reservation',
    category: 'functional',
    tags: ['reservation', 'create'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: {
        'X-Idempotency-Key': '{{idempotencyKey}}',
      },
      body: {
        spotId: 1,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startTime: futureDate(48),
        endTime: futureDate(50),
      },
    },
    expected: {
      status: 201,
      bodyContains: {
        success: true,
        message: 'Reservation created successfully',
      },
      bodyMatches: (body) => {
        const b = body as { data?: { id: number; spotNumber: string } };
        return b.data?.id !== undefined && b.data?.spotNumber !== undefined;
      },
    },
  },

  {
    id: 'create-reservation-with-setup',
    name: 'Create reservation and verify retrieval',
    description: 'Create a reservation and then retrieve it by ID',
    category: 'functional',
    tags: ['reservation', 'create', 'get'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
          body: {
            spotId: 2,
            customerName: 'Jane Smith',
            customerEmail: 'jane@example.com',
            startTime: futureDate(72),
            endTime: futureDate(74),
          },
        },
        saveAs: 'createdReservation',
      },
    ],
    request: {
      method: 'GET',
      path: '/api/carpark/reservations/{{createdReservationId}}',
    },
    expected: {
      status: 200,
      bodyContains: { success: true },
      bodyMatches: (body) => {
        const b = body as { data?: { customerName: string } };
        return b.data?.customerName === 'Jane Smith';
      },
    },
  },

  // ============================================
  // IDEMPOTENCY TESTS
  // ============================================
  {
    id: 'idempotency-same-key-same-response',
    name: 'Idempotency: Same key returns same response',
    description: 'Sending the same idempotency key should return cached response',
    category: 'functional',
    tags: ['idempotency', 'reservation'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': 'fixed-key-idempotency-test-001' },
          body: {
            spotId: 3,
            customerName: 'Idempotency Test',
            customerEmail: 'idem@test.com',
            startTime: futureDate(100),
            endTime: futureDate(102),
          },
        },
        saveAs: 'firstResponse',
      },
    ],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': 'fixed-key-idempotency-test-001' },
      body: {
        spotId: 3,
        customerName: 'Idempotency Test',
        customerEmail: 'idem@test.com',
        startTime: futureDate(100),
        endTime: futureDate(102),
      },
    },
    expected: {
      status: 201,
      bodyContains: { success: true },
    },
  },

  {
    id: 'idempotency-missing-key',
    name: 'Idempotency: Missing key returns 400',
    description: 'POST without idempotency key should fail',
    category: 'functional',
    tags: ['idempotency', 'error'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      body: {
        spotId: 1,
        customerName: 'No Key',
        customerEmail: 'nokey@test.com',
        startTime: futureDate(200),
        endTime: futureDate(202),
      },
    },
    expected: {
      status: 400,
      bodyContains: { error: 'Missing required header' },
    },
  },

  // ============================================
  // RESERVATION RETRIEVAL
  // ============================================
  {
    id: 'get-reservation-not-found',
    name: 'Get non-existent reservation returns 404',
    description: 'Requesting a reservation that does not exist',
    category: 'functional',
    tags: ['reservation', 'get', 'error'],
    request: {
      method: 'GET',
      path: '/api/carpark/reservations/99999',
    },
    expected: {
      status: 404,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // RESERVATION CANCELLATION
  // ============================================
  {
    id: 'cancel-reservation-success',
    name: 'Cancel an existing reservation',
    description: 'Successfully cancel a reservation',
    category: 'functional',
    tags: ['reservation', 'delete', 'cancel'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
          body: {
            spotId: 4,
            customerName: 'To Cancel',
            customerEmail: 'cancel@test.com',
            startTime: futureDate(150),
            endTime: futureDate(152),
          },
        },
        saveAs: 'toCancel',
      },
    ],
    request: {
      method: 'DELETE',
      path: '/api/carpark/reservations/{{toCancelId}}',
    },
    expected: {
      status: 200,
      bodyContains: {
        success: true,
        message: 'Reservation cancelled successfully',
      },
    },
  },

  {
    id: 'cancel-reservation-not-found',
    name: 'Cancel non-existent reservation returns 404',
    description: 'Cancelling a reservation that does not exist',
    category: 'functional',
    tags: ['reservation', 'delete', 'error'],
    request: {
      method: 'DELETE',
      path: '/api/carpark/reservations/99999',
    },
    expected: {
      status: 404,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // ERROR HANDLING
  // ============================================
  {
    id: 'invalid-endpoint',
    name: 'Invalid endpoint returns 404',
    description: 'Accessing a non-existent endpoint',
    category: 'functional',
    tags: ['error', 'routing'],
    request: {
      method: 'GET',
      path: '/api/nonexistent',
    },
    expected: {
      status: 404,
    },
  },

  {
    id: 'reserve-spot-not-found',
    name: 'Reserve non-existent spot returns 404',
    description: 'Trying to reserve a spot that does not exist',
    category: 'functional',
    tags: ['reservation', 'error'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 99999,
        customerName: 'Test',
        customerEmail: 'test@test.com',
        startTime: futureDate(200),
        endTime: futureDate(202),
      },
    },
    expected: {
      status: 404,
      bodyContains: { success: false },
    },
  },
];
