import {
  getAvailableSpots,
  getSpotById,
  createReservation,
  getReservationById,
  deleteReservation,
  hasOverlappingReservation,
} from '../database';
import { AvailableSpot, ReservationRequest, ReservationResponse } from '../types';

export class ReservationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ReservationError';
  }
}

export function queryAvailability(
  floor?: number,
  startTime?: string,
  endTime?: string
): AvailableSpot[] {
  const spots = getAvailableSpots(floor, startTime, endTime);
  return spots.map((spot) => ({
    id: spot.id,
    spotNumber: spot.spot_number,
    floor: spot.floor,
  }));
}

export function makeReservation(request: ReservationRequest): ReservationResponse {
  const { spotId, customerName, customerEmail, startTime, endTime } = request;

  // Validate the spot exists
  const spot = getSpotById(spotId);
  if (!spot) {
    throw new ReservationError('Parking spot not found', 404);
  }

  // Check if the spot is available
  if (!spot.is_available) {
    throw new ReservationError('Parking spot is not available for reservations', 400);
  }

  // Validate time range
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new ReservationError('End time must be after start time', 400);
  }

  if (start < new Date()) {
    throw new ReservationError('Start time cannot be in the past', 400);
  }

  // Check for overlapping reservations
  if (hasOverlappingReservation(spotId, startTime, endTime)) {
    throw new ReservationError(
      'This spot is already reserved for the requested time period',
      409
    );
  }

  // Create the reservation
  const reservation = createReservation(spotId, customerName, customerEmail, startTime, endTime);

  return {
    id: reservation.id,
    spotId: reservation.spot_id,
    spotNumber: spot.spot_number,
    customerName: reservation.customer_name,
    customerEmail: reservation.customer_email,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    createdAt: reservation.created_at,
  };
}

export function getReservation(id: number): ReservationResponse {
  const reservation = getReservationById(id);
  if (!reservation) {
    throw new ReservationError('Reservation not found', 404);
  }

  const spot = getSpotById(reservation.spot_id);
  if (!spot) {
    throw new ReservationError('Associated parking spot not found', 500);
  }

  return {
    id: reservation.id,
    spotId: reservation.spot_id,
    spotNumber: spot.spot_number,
    customerName: reservation.customer_name,
    customerEmail: reservation.customer_email,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    createdAt: reservation.created_at,
  };
}

export function cancelReservation(id: number): void {
  const deleted = deleteReservation(id);
  if (!deleted) {
    throw new ReservationError('Reservation not found', 404);
  }
}
