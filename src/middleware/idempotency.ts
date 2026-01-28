import { Request, Response, NextFunction } from 'express';
import { getIdempotencyRecord, saveIdempotencyRecord } from '../database';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export interface IdempotentResponse extends Response {
  idempotencyKey?: string;
}

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers[IDEMPOTENCY_HEADER];

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    res.status(400).json({
      error: 'Missing required header',
      message: `The ${IDEMPOTENCY_HEADER} header is required for this endpoint`,
    });
    return;
  }

  if (idempotencyKey.length < 1 || idempotencyKey.length > 255) {
    res.status(400).json({
      error: 'Invalid idempotency key',
      message: 'Idempotency key must be between 1 and 255 characters',
    });
    return;
  }

  // Check if we have a cached response for this key
  const cachedRecord = getIdempotencyRecord(idempotencyKey);

  if (cachedRecord) {
    // Return the cached response
    res.status(cachedRecord.response_status).json(JSON.parse(cachedRecord.response_body));
    return;
  }

  // Store the key on the response for later use
  (res as IdempotentResponse).idempotencyKey = idempotencyKey;

  // Override res.json to capture and store the response
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown): Response {
    const idempotentRes = res as IdempotentResponse;
    if (idempotentRes.idempotencyKey) {
      try {
        saveIdempotencyRecord(
          idempotentRes.idempotencyKey,
          res.statusCode,
          JSON.stringify(body)
        );
      } catch (error) {
        // If saving fails (e.g., duplicate key race condition), log but don't fail the request
        console.error('Failed to save idempotency record:', error);
      }
    }
    return originalJson(body);
  };

  next();
}
