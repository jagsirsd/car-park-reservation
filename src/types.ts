import { z } from 'zod';

// Database row types
export interface CarParkSpot {
  id: number;
  spot_number: string;
  floor: number;
  is_available: number; // SQLite uses 0/1 for boolean
}

export interface Reservation {
  id: number;
  spot_id: number;
  customer_name: string;
  customer_email: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface IdempotencyRecord {
  key: string;
  response_status: number;
  response_body: string;
  created_at: string;
}

// API response types
export interface AvailableSpot {
  id: number;
  spotNumber: string;
  floor: number;
}

export interface ReservationResponse {
  id: number;
  spotId: number;
  spotNumber: string;
  customerName: string;
  customerEmail: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

// Request validation schemas
export const ReservationRequestSchema = z.object({
  spotId: z.number().int().positive(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export type ReservationRequest = z.infer<typeof ReservationRequestSchema>;

export const AvailabilityQuerySchema = z.object({
  floor: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
});

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;
