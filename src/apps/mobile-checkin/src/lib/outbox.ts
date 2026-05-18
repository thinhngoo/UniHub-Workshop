import * as SQLite from 'expo-sqlite';
import type { CheckInBatchItemStatus } from '@unihub/types';

/**
 * Offline check-in outbox.
 *
 *   1. Scanner inserts a row with status='pending' immediately on a valid QR.
 *   2. When the device is online, the queue screen reads all pending rows,
 *      sends a single `POST /checkin/batch`, then updates each row to
 *      reflect the server's accept/reject decision.
 *   3. The row is keyed by `clientEventId` (UUID generated on-device), which
 *      is the same id the server uses for dedupe.
 */

export type OutboxLocalStatus = 'pending' | 'sent' | 'failed';

export interface OutboxRow {
  clientEventId: string;
  qrToken: string;
  scannedAt: string;
  status: OutboxLocalStatus;
  resultStatus: CheckInBatchItemStatus | null;
  registrationId: string | null;
  message: string | null;
  createdAt: string;
  syncedAt: string | null;
}

interface OutboxDbRow {
  client_event_id: string;
  qr_token: string;
  scanned_at: string;
  status: string;
  result_status: string | null;
  registration_id: string | null;
  message: string | null;
  created_at: string;
  synced_at: string | null;
}

const DB_NAME = 'unihub-checkin-outbox.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const handle = await SQLite.openDatabaseAsync(DB_NAME);
      await handle.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS outbox (
          client_event_id TEXT PRIMARY KEY NOT NULL,
          qr_token        TEXT NOT NULL,
          scanned_at      TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending',
          result_status   TEXT,
          registration_id TEXT,
          message         TEXT,
          created_at      TEXT NOT NULL,
          synced_at       TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
        CREATE INDEX IF NOT EXISTS idx_outbox_status_created_at ON outbox(status, created_at);
      `);
      return handle;
    })();
  }
  return dbPromise;
}

export async function enqueue(args: {
  clientEventId: string;
  qrToken: string;
  scannedAt: string;
}): Promise<void> {
  const handle = await db();
  await handle.runAsync(
    `INSERT OR IGNORE INTO outbox (
       client_event_id, qr_token, scanned_at, status, created_at
     ) VALUES (?, ?, ?, 'pending', ?)`,
    [args.clientEventId, args.qrToken, args.scannedAt, new Date().toISOString()],
  );
}

export async function listAll(): Promise<OutboxRow[]> {
  const handle = await db();
  const rows = await handle.getAllAsync<OutboxDbRow>(
    `SELECT * FROM outbox ORDER BY created_at DESC`,
  );
  return rows.map(toRow);
}

export async function listPending(): Promise<OutboxRow[]> {
  const handle = await db();
  const rows = await handle.getAllAsync<OutboxDbRow>(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC`,
  );
  return rows.map(toRow);
}

export async function countByStatus(): Promise<Record<OutboxLocalStatus, number>> {
  const handle = await db();
  const rows = await handle.getAllAsync<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM outbox GROUP BY status`,
  );
  const out: Record<OutboxLocalStatus, number> = { pending: 0, sent: 0, failed: 0 };
  for (const r of rows) {
    if (r.status === 'pending' || r.status === 'sent' || r.status === 'failed') {
      out[r.status] = r.n;
    }
  }
  return out;
}

export async function markResults(
  results: Array<{
    clientEventId: string;
    status: OutboxLocalStatus;
    resultStatus: CheckInBatchItemStatus | null;
    registrationId: string | null;
    message: string | null;
  }>,
): Promise<void> {
  if (results.length === 0) return;
  const handle = await db();
  const syncedAt = new Date().toISOString();
  await handle.withTransactionAsync(async () => {
    for (const r of results) {
      await handle.runAsync(
        `UPDATE outbox
            SET status = ?, result_status = ?, registration_id = ?, message = ?, synced_at = ?
          WHERE client_event_id = ?`,
        [r.status, r.resultStatus, r.registrationId, r.message, syncedAt, r.clientEventId],
      );
    }
  });
}

export async function markBatchFailed(clientEventIds: string[], message: string): Promise<void> {
  if (clientEventIds.length === 0) return;
  const handle = await db();
  const syncedAt = new Date().toISOString();
  await handle.withTransactionAsync(async () => {
    for (const id of clientEventIds) {
      await handle.runAsync(
        `UPDATE outbox
            SET status = 'failed', message = ?, synced_at = ?
          WHERE client_event_id = ?`,
        [message, syncedAt, id],
      );
    }
  });
}

export async function clearSynced(): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM outbox WHERE status = 'sent'`);
}

export async function deleteOne(clientEventId: string): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM outbox WHERE client_event_id = ?`, [clientEventId]);
}

export async function clearAll(): Promise<void> {
  const handle = await db();
  await handle.runAsync(`DELETE FROM outbox`);
}

function toRow(r: OutboxDbRow): OutboxRow {
  return {
    clientEventId: r.client_event_id,
    qrToken: r.qr_token,
    scannedAt: r.scanned_at,
    status: r.status === 'sent' || r.status === 'failed' ? r.status : 'pending',
    resultStatus: (r.result_status as CheckInBatchItemStatus | null) ?? null,
    registrationId: r.registration_id,
    message: r.message,
    createdAt: r.created_at,
    syncedAt: r.synced_at,
  };
}
