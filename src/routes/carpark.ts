import { Router, Request, Response } from 'express';
import { requireIdempotencyKey } from '../middleware/idempotency';
import {
  queryAvailability,
  makeReservation,
  getReservation,
  cancelReservation,
  ReservationError,
} from '../services/reservation';
import { ReservationRequestSchema, AvailabilityQuerySchema } from '../types';
import { ZodError } from 'zod';

const router = Router();

// GET /api/carpark/availability
router.get('/availability', (req: Request, res: Response) => {
  try {
    const query = AvailabilityQuerySchema.parse(req.query);
    const spots = queryAvailability(query.floor, query.start_time, query.end_time);

    res.json({
      success: true,
      data: spots,
      count: spots.length,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }
    throw error;
  }
});

// POST /api/carpark/reserve
router.post('/reserve', requireIdempotencyKey, (req: Request, res: Response) => {
  try {
    const request = ReservationRequestSchema.parse(req.body);
    const reservation = makeReservation(request);

    res.status(201).json({
      success: true,
      data: reservation,
      message: 'Reservation created successfully',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error.errors,
      });
      return;
    }
    if (error instanceof ReservationError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
      return;
    }
    throw error;
  }
});

// GET /api/carpark/reservations/:id
router.get('/reservations/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reservation ID',
      });
      return;
    }

    const reservation = getReservation(id);
    res.json({
      success: true,
      data: reservation,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
      return;
    }
    throw error;
  }
});

// DELETE /api/carpark/reservations/:id
router.delete('/reservations/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reservation ID',
      });
      return;
    }

    cancelReservation(id);
    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
      return;
    }
    throw error;
  }
});

export default router;
