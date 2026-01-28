import express, { Request, Response, NextFunction } from 'express';
import { initializeDatabase, cleanupExpiredIdempotencyKeys } from './database';
import carparkRoutes from './routes/carpark';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/carpark', carparkRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Initialize and start
async function start(): Promise<void> {
  console.log('Initializing database...');
  await initializeDatabase();

  // Clean up expired idempotency keys on startup
  const cleaned = cleanupExpiredIdempotencyKeys(24);
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired idempotency keys`);
  }

  app.listen(PORT, () => {
    console.log(`Car Park Reservation API running on http://localhost:${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log(`  GET  http://localhost:${PORT}/api/carpark/availability`);
    console.log(`  POST http://localhost:${PORT}/api/carpark/reserve`);
    console.log(`  GET  http://localhost:${PORT}/api/carpark/reservations/:id`);
    console.log(`  DELETE http://localhost:${PORT}/api/carpark/reservations/:id`);
    console.log(`  GET  http://localhost:${PORT}/health`);
  });
}

start().catch(console.error);
