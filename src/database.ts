import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { CarParkSpot, Reservation, IdempotencyRecord } from './types';

let db: SqlJsDatabase;
const dbPath = path.join(__dirname, '..', 'carpark.db');

// Helper to convert sql.js result to objects
function rowsToObjects<T>(columns: string[], values: unknown[][]): T[] {
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

// Helper to run a query and get results as objects
function query<T>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as T);
  }
  stmt.free();
  return results;
}

// Helper to run a query and get a single result
function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

function isBindParams(x: unknown): x is any[] {
  return Array.isArray(x);
}

// Helper to run a statement (INSERT, UPDATE, DELETE)
function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {

  if (!isBindParams(params)) {
    throw new Error("Invalid bind params");
  }
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastIdResult = query<{ id: number }>('SELECT last_insert_rowid() as id');
  const lastInsertRowid = lastIdResult[0]?.id ?? 0;
  return { changes, lastInsertRowid };
}

// Save database to file
function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Initialize database
export async function initializeDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Create schema
  db.run(`
    CREATE TABLE IF NOT EXISTS car_park_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_number TEXT UNIQUE NOT NULL,
      floor INTEGER NOT NULL,
      is_available INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (spot_id) REFERENCES car_park_spots(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_spot_time ON reservations(spot_id, start_time, end_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at)`);

  // Seed parking spots if none exist
  const count = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM car_park_spots');
  if (count && count.count === 0) {
    for (let i = 1; i <= 10; i++) {
      db.run('INSERT INTO car_park_spots (spot_number, floor) VALUES (?, ?)', [`A${i}`, 1]);
      db.run('INSERT INTO car_park_spots (spot_number, floor) VALUES (?, ?)', [`B${i}`, 2]);
    }
    console.log('Seeded 20 parking spots');
  }

  saveDatabase();
}

// Idempotency key operations
export function getIdempotencyRecord(key: string): IdempotencyRecord | undefined {
  return queryOne<IdempotencyRecord>('SELECT * FROM idempotency_keys WHERE key = ?', [key]);
}

export function saveIdempotencyRecord(key: string, status: number, body: string): void {
  const now = new Date().toISOString();
  run('INSERT INTO idempotency_keys (key, response_status, response_body, created_at) VALUES (?, ?, ?, ?)',
    [key, status, body, now]);
  saveDatabase();
}

export function cleanupExpiredIdempotencyKeys(hoursOld: number = 24): number {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
  const result = run('DELETE FROM idempotency_keys WHERE created_at < ?', [cutoff]);
  if (result.changes > 0) {
    saveDatabase();
  }
  return result.changes;
}

// Car park spot operations
export function getAllSpots(): CarParkSpot[] {
  return query<CarParkSpot>('SELECT * FROM car_park_spots ORDER BY floor, spot_number');
}

export function getAvailableSpots(floor?: number, startTime?: string, endTime?: string): CarParkSpot[] {
  let sql = 'SELECT * FROM car_park_spots WHERE is_available = 1';
  const params: unknown[] = [];

  if (floor !== undefined) {
    sql += ' AND floor = ?';
    params.push(floor);
  }

  if (startTime && endTime) {
    sql += ` AND id NOT IN (
      SELECT spot_id FROM reservations
      WHERE start_time < ? AND end_time > ?
    )`;
    params.push(endTime, startTime);
  }

  sql += ' ORDER BY floor, spot_number';
  return query<CarParkSpot>(sql, params);
}

export function getSpotById(id: number): CarParkSpot | undefined {
  return queryOne<CarParkSpot>('SELECT * FROM car_park_spots WHERE id = ?', [id]);
}

// Reservation operations
export function createReservation(
  spotId: number,
  customerName: string,
  customerEmail: string,
  startTime: string,
  endTime: string
): Reservation {
  const now = new Date().toISOString();
  const result = run(
    'INSERT INTO reservations (spot_id, customer_name, customer_email, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [spotId, customerName, customerEmail, startTime, endTime, now]
  );
  saveDatabase();
  return queryOne<Reservation>('SELECT * FROM reservations WHERE id = ?', [result.lastInsertRowid])!;
}

export function getReservationById(id: number): Reservation | undefined {
  return queryOne<Reservation>('SELECT * FROM reservations WHERE id = ?', [id]);
}

export function deleteReservation(id: number): boolean {
  const result = run('DELETE FROM reservations WHERE id = ?', [id]);
  if (result.changes > 0) {
    saveDatabase();
  }
  return result.changes > 0;
}

export function hasOverlappingReservation(spotId: number, startTime: string, endTime: string): boolean {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM reservations WHERE spot_id = ? AND start_time < ? AND end_time > ?',
    [spotId, endTime, startTime]
  );
  return (result?.count ?? 0) > 0;
}

export function getDatabase(): SqlJsDatabase {
  return db;
}
