import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

// A tiny per-user key/value store backed by SQLite. One row per
// (user_id, namespace), value is JSON. Persists across server restarts and is
// shared by any device that reaches this server.

type DB = import("better-sqlite3").Database;

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __djxDb?: DB };

function getDb(): DB {
  if (globalForDb.__djxDb) return globalForDb.__djxDb;

  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "djx.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      user_id    TEXT NOT NULL,
      namespace  TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, namespace)
    );
  `);
  globalForDb.__djxDb = db;
  return db;
}

export function readKV<T>(userId: string, namespace: string): T | null {
  const row = getDb()
    .prepare("SELECT value FROM kv WHERE user_id = ? AND namespace = ?")
    .get(userId, namespace) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function writeKV(userId: string, namespace: string, value: unknown) {
  getDb()
    .prepare(
      `INSERT INTO kv (user_id, namespace, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, namespace)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(userId, namespace, JSON.stringify(value), Date.now());
}
