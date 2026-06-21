import type BetterSqlite3 from "better-sqlite3";

// A tiny per-user key/value store with two backends, auto-selected by env:
//   - Upstash Redis (REST) when UPSTASH_/KV_ vars are set — works on Vercel.
//   - SQLite file (better-sqlite3) otherwise — local dev, persists on disk.
// One logical entry per (userId, namespace); value is JSON.

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const useUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const redisKey = (userId: string, namespace: string) =>
  `djx:${namespace}:${userId}`;

async function redis(command: string[]): Promise<unknown> {
  const r = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`Upstash responded ${r.status}`);
  const j = await r.json().catch(() => null);
  return j?.result;
}

// --- SQLite backend (lazy: only loaded when Upstash isn't configured) ---

let dbPromise: Promise<BetterSqlite3.Database> | null = null;

async function getDb(): Promise<BetterSqlite3.Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { default: Database } = await import("better-sqlite3");
      const { mkdirSync } = await import("node:fs");
      const path = await import("node:path");
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
      return db;
    })();
  }
  return dbPromise;
}

// --- Public API (async; backend-agnostic) ---

export async function readKV<T>(
  userId: string,
  namespace: string,
): Promise<T | null> {
  if (useUpstash) {
    const v = await redis(["GET", redisKey(userId, namespace)]);
    if (typeof v !== "string") return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  const db = await getDb();
  const row = db
    .prepare("SELECT value FROM kv WHERE user_id = ? AND namespace = ?")
    .get(userId, namespace) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function writeKV(
  userId: string,
  namespace: string,
  value: unknown,
): Promise<void> {
  const json = JSON.stringify(value);

  if (useUpstash) {
    await redis(["SET", redisKey(userId, namespace), json]);
    return;
  }

  const db = await getDb();
  db.prepare(
    `INSERT INTO kv (user_id, namespace, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, namespace)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(userId, namespace, json, Date.now());
}
