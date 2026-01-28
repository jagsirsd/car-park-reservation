import { TestSpec } from '../types';

// Helper to generate timestamps
const futureDate = (hoursFromNow: number): string => {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return date.toISOString();
};

const pastDate = (hoursAgo: number): string => {
  const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return date.toISOString();
};

export const boundarySpecs: TestSpec[] = [
  // ============================================
  // INPUT VALIDATION - CUSTOMER NAME
  // ============================================
  {
    id: 'boundary-empty-customer-name',
    name: 'Empty customer name should fail',
    description: 'Customer name cannot be empty',
    category: 'boundary',
    tags: ['validation', 'customer-name'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: '',
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-very-long-customer-name',
    name: 'Very long customer name should fail',
    description: 'Customer name exceeds maximum length (100 chars)',
    category: 'boundary',
    tags: ['validation', 'customer-name'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'A'.repeat(101),
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-max-length-customer-name',
    name: 'Maximum length customer name should succeed',
    description: 'Customer name at exactly 100 characters',
    category: 'boundary',
    tags: ['validation', 'customer-name'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 5,
        customerName: 'A'.repeat(100),
        customerEmail: 'boundary@test.com',
        startTime: futureDate(310),
        endTime: futureDate(312),
      },
    },
    expected: {
      status: 201,
      bodyContains: { success: true },
    },
  },

  // ============================================
  // INPUT VALIDATION - EMAIL
  // ============================================
  {
    id: 'boundary-invalid-email-no-at',
    name: 'Invalid email without @ should fail',
    description: 'Email must contain @',
    category: 'boundary',
    tags: ['validation', 'email'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'invalidemail.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-invalid-email-no-domain',
    name: 'Invalid email without domain should fail',
    description: 'Email must have a domain',
    category: 'boundary',
    tags: ['validation', 'email'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'test@',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-empty-email',
    name: 'Empty email should fail',
    description: 'Email cannot be empty',
    category: 'boundary',
    tags: ['validation', 'email'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: '',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // INPUT VALIDATION - SPOT ID
  // ============================================
  {
    id: 'boundary-negative-spot-id',
    name: 'Negative spot ID should fail',
    description: 'Spot ID must be positive',
    category: 'boundary',
    tags: ['validation', 'spot-id'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: -1,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-zero-spot-id',
    name: 'Zero spot ID should fail',
    description: 'Spot ID must be positive integer',
    category: 'boundary',
    tags: ['validation', 'spot-id'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 0,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-float-spot-id',
    name: 'Float spot ID should fail',
    description: 'Spot ID must be an integer',
    category: 'boundary',
    tags: ['validation', 'spot-id'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1.5,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // INPUT VALIDATION - TIME RANGE
  // ============================================
  {
    id: 'boundary-end-before-start',
    name: 'End time before start time should fail',
    description: 'End time must be after start time',
    category: 'boundary',
    tags: ['validation', 'time'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(304),
        endTime: futureDate(302),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-same-start-end-time',
    name: 'Same start and end time should fail',
    description: 'Reservation must have duration',
    category: 'boundary',
    tags: ['validation', 'time'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(300),
        endTime: futureDate(300),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-past-start-time',
    name: 'Start time in the past should fail',
    description: 'Cannot create reservations in the past',
    category: 'boundary',
    tags: ['validation', 'time'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: pastDate(2),
        endTime: pastDate(1),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-invalid-datetime-format',
    name: 'Invalid datetime format should fail',
    description: 'Datetime must be ISO 8601 format',
    category: 'boundary',
    tags: ['validation', 'time'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: '2024-13-45 99:99:99',
        endTime: 'not-a-date',
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // CONFLICT HANDLING
  // ============================================
  {
    id: 'boundary-double-booking-exact-overlap',
    name: 'Exact time overlap should fail',
    description: 'Cannot book same spot for same time',
    category: 'boundary',
    tags: ['conflict', 'double-booking'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
          body: {
            spotId: 6,
            customerName: 'First Booker',
            customerEmail: 'first@test.com',
            startTime: futureDate(400),
            endTime: futureDate(402),
          },
        },
        saveAs: 'firstBooking',
      },
    ],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 6,
        customerName: 'Second Booker',
        customerEmail: 'second@test.com',
        startTime: futureDate(400),
        endTime: futureDate(402),
      },
    },
    expected: {
      status: 409,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-double-booking-partial-overlap',
    name: 'Partial time overlap should fail',
    description: 'Cannot book overlapping time ranges',
    category: 'boundary',
    tags: ['conflict', 'double-booking'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
          body: {
            spotId: 7,
            customerName: 'First Booker',
            customerEmail: 'first@test.com',
            startTime: futureDate(500),
            endTime: futureDate(504),
          },
        },
        saveAs: 'partialFirst',
      },
    ],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 7,
        customerName: 'Second Booker',
        customerEmail: 'second@test.com',
        startTime: futureDate(502),
        endTime: futureDate(506),
      },
    },
    expected: {
      status: 409,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-adjacent-booking-allowed',
    name: 'Adjacent (non-overlapping) booking should succeed',
    description: 'Can book immediately after another booking ends',
    category: 'boundary',
    tags: ['conflict', 'adjacent'],
    setup: [
      {
        type: 'request',
        request: {
          method: 'POST',
          path: '/api/carpark/reserve',
          headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
          body: {
            spotId: 8,
            customerName: 'First Booker',
            customerEmail: 'first@test.com',
            startTime: futureDate(600),
            endTime: futureDate(602),
          },
        },
        saveAs: 'adjacentFirst',
      },
    ],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 8,
        customerName: 'Second Booker',
        customerEmail: 'second@test.com',
        startTime: futureDate(602),
        endTime: futureDate(604),
      },
    },
    expected: {
      status: 201,
      bodyContains: { success: true },
    },
  },

  // ============================================
  // RESERVATION ID VALIDATION
  // ============================================
  {
    id: 'boundary-invalid-reservation-id-string',
    name: 'String reservation ID should fail',
    description: 'Reservation ID must be numeric',
    category: 'boundary',
    tags: ['validation', 'reservation-id'],
    request: {
      method: 'GET',
      path: '/api/carpark/reservations/abc',
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-negative-reservation-id',
    name: 'Negative reservation ID returns 404',
    description: 'Negative ID treated as not found',
    category: 'boundary',
    tags: ['validation', 'reservation-id'],
    request: {
      method: 'GET',
      path: '/api/carpark/reservations/-1',
    },
    expected: {
      status: 404,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // MISSING FIELDS
  // ============================================
  {
    id: 'boundary-missing-spot-id',
    name: 'Missing spot ID should fail',
    description: 'spotId is required',
    category: 'boundary',
    tags: ['validation', 'required-fields'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        startTime: futureDate(700),
        endTime: futureDate(702),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-missing-customer-name',
    name: 'Missing customer name should fail',
    description: 'customerName is required',
    category: 'boundary',
    tags: ['validation', 'required-fields'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {
        spotId: 1,
        customerEmail: 'test@test.com',
        startTime: futureDate(700),
        endTime: futureDate(702),
      },
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  {
    id: 'boundary-empty-body',
    name: 'Empty request body should fail',
    description: 'Request body cannot be empty',
    category: 'boundary',
    tags: ['validation', 'required-fields'],
    request: {
      method: 'POST',
      path: '/api/carpark/reserve',
      headers: { 'X-Idempotency-Key': '{{idempotencyKey}}' },
      body: {},
    },
    expected: {
      status: 400,
      bodyContains: { success: false },
    },
  },

  // ============================================
  // FLOOR FILTER BOUNDARY
  // ============================================
  {
    id: 'boundary-non-existent-floor',
    name: 'Non-existent floor returns empty array',
    description: 'Querying a floor that does not exist',
    category: 'boundary',
    tags: ['availability', 'filter'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: { floor: '999' },
    },
    expected: {
      status: 200,
      bodyContains: { success: true, count: 0 },
    },
  },

  {
    id: 'boundary-invalid-floor-string',
    name: 'Non-numeric floor filter',
    description: 'Floor must be a number',
    category: 'boundary',
    tags: ['availability', 'filter', 'validation'],
    request: {
      method: 'GET',
      path: '/api/carpark/availability',
      query: { floor: 'abc' },
    },
    expected: {
      // NaN floor is converted, should still work (returns all or empty)
      statusRange: { min: 200, max: 200 },
      bodyContains: { success: true },
    },
  },
];
