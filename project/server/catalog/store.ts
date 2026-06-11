/**
 * Durable persistence for the car catalogue.
 *
 * Serverless functions (Netlify) have a read-only filesystem except for the
 * ephemeral /tmp dir, so admin edits cannot be written back to source files and
 * a /tmp write does not survive a cold start. The durable store is therefore a
 * Postgres database:
 *
 *   1. Postgres — durable across deploys & instances. Used whenever a connection
 *      string is configured (NETLIFY_DATABASE_URL in prod, DATABASE_URL in dev).
 *      The whole catalogue is stored as a single JSONB row.
 *   2. A local JSON file — used ONLY for local dev when no database is
 *      configured, so the app still renders something sensible.
 *
 * Reads prefer the persisted copy and fall back to the seed data. Once an admin
 * saves, the persisted copy is authoritative.
 */

import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";
import { Car, cloneSeed } from "./data";

// The current Netlify Database (in-project, powered by Neon) exposes
// NETLIFY_DB_URL. The deprecated Netlify DB extension exposed
// NETLIFY_DATABASE_URL / NETLIFY_DATABASE_URL_UNPOOLED. Plain Postgres / Replit
// dev exposes DATABASE_URL. Accept all so the app works regardless of how the
// database was provisioned.
const CONNECTION_STRING =
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  "";

// Local file fallback. On Lambda/Netlify only /tmp is writable.
const DATA_DIR = process.env.LAMBDA_TASK_ROOT
  ? "/tmp/carnextdrive-data"
  : path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "catalog.json");

// Short-lived in-memory cache so a warm function instance doesn't hit the
// store on every request. Invalidated on writes.
let cache: { cars: Car[]; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

// ── Postgres ────────────────────────────────────────────────────────────────
// Single pool reused across warm invocations. max:1 keeps connection use low in
// the serverless runtime (Neon's pooled endpoint handles concurrency).
let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

function sslConfig(cs: string): false | { rejectUnauthorized: boolean } {
  if (/sslmode=disable/.test(cs)) return false;
  // Managed cloud Postgres (Neon, Netlify DB, AWS) requires SSL; an internal
  // dev host (e.g. Replit) typically doesn't.
  if (/sslmode=require|neon\.tech|netlify|\.aws\.|amazonaws/.test(cs)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

function getPool(): Pool | null {
  if (!CONNECTION_STRING) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: CONNECTION_STRING,
      max: 1,
      ssl: sslConfig(CONNECTION_STRING),
    });
  }
  return pool;
}

function ensureTable(p: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = p
      .query(
        `CREATE TABLE IF NOT EXISTS catalog (
           id integer PRIMARY KEY DEFAULT 1,
           cars jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now(),
           CONSTRAINT catalog_single_row CHECK (id = 1)
         )`,
      )
      .then(() => undefined)
      .catch((err) => {
        // Reset so a later call can retry instead of caching the failure.
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

function isValidCatalog(value: unknown): value is Car[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as any).id === "string" &&
        typeof (c as any).name === "string" &&
        typeof (c as any).weekly === "number" &&
        typeof (c as any).monthly === "number",
    )
  );
}

async function readFromDb(): Promise<Car[] | null> {
  const p = getPool();
  if (!p) return null;
  try {
    await ensureTable(p);
    const { rows } = await p.query("SELECT cars FROM catalog WHERE id = 1");
    if (rows.length === 0) return null;
    const cars = rows[0].cars;
    return isValidCatalog(cars) ? cars : null;
  } catch (err) {
    console.warn(
      "[catalog] Postgres read failed:",
      (err as any)?.message || err,
    );
    return null;
  }
}

async function writeToDb(cars: Car[]): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await ensureTable(p);
    await p.query(
      `INSERT INTO catalog (id, cars, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET cars = EXCLUDED.cars, updated_at = now()`,
      [JSON.stringify(cars)],
    );
    return true;
  } catch (err) {
    console.error(
      "[catalog] Postgres write failed:",
      (err as any)?.message || err,
    );
    return false;
  }
}

async function readFromFile(): Promise<Car[] | null> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return isValidCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeToFile(cars: Car[]): Promise<boolean> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(cars, null, 2), "utf8");
    return true;
  } catch (err) {
    console.warn("[catalog] file write failed:", (err as any)?.message || err);
    return false;
  }
}

/**
 * Read-only diagnostics for confirming the durable store is wired up in a given
 * environment, without exposing the connection string. Safe to expose publicly:
 * it returns booleans/counts only, never the credentials or the catalogue.
 */
export async function getStoreHealth(): Promise<{
  hasConnectionString: boolean;
  dbReadable: boolean;
  carCount: number | null;
  source: "postgres" | "file" | "seed";
  error?: string;
}> {
  const hasConnectionString = Boolean(CONNECTION_STRING);
  if (hasConnectionString) {
    const p = getPool();
    try {
      await ensureTable(p!);
      const { rows } = await p!.query("SELECT cars FROM catalog WHERE id = 1");
      const cars = rows.length ? rows[0].cars : null;
      return {
        hasConnectionString,
        dbReadable: true,
        carCount: isValidCatalog(cars) ? cars.length : 0,
        source: "postgres",
      };
    } catch (err) {
      return {
        hasConnectionString,
        dbReadable: false,
        carCount: null,
        source: "postgres",
        error: (err as any)?.message || String(err),
      };
    }
  }
  const fileCars = await readFromFile();
  return {
    hasConnectionString,
    dbReadable: false,
    carCount: (fileCars ?? cloneSeed()).length,
    source: fileCars ? "file" : "seed",
  };
}

/** Returns the full catalogue (persisted copy if present, else seed). */
export async function getCatalog(): Promise<Car[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.cars;
  }
  const cars = (await readFromDb()) ?? (await readFromFile()) ?? cloneSeed();
  cache = { cars, at: Date.now() };
  return cars;
}

/** Catalogue keyed by id — convenient for lookups (pricing, validation). */
export async function getCatalogMap(): Promise<Record<string, Car>> {
  const cars = await getCatalog();
  return Object.fromEntries(cars.map((c) => [c.id, c]));
}

/**
 * Persist the entire catalogue. When a database is configured (production and
 * Replit dev), Postgres is the only durable backend — a file-only write lands
 * on ephemeral /tmp and would silently disappear on the next cold start, which
 * is why admin edits used to "revert after some time". So we only report
 * success when the durable backend accepted the write, letting the admin route
 * surface a real error instead of losing the change later.
 */
export async function saveCatalog(cars: Car[]): Promise<boolean> {
  const hasDb = Boolean(CONNECTION_STRING);
  const dbOk = await writeToDb(cars);
  const fileOk = await writeToFile(cars);
  // Update cache regardless so the running instance is immediately consistent.
  cache = { cars, at: Date.now() };

  const durable = hasDb ? dbOk : fileOk;
  if (!durable) {
    console.error(
      `[catalog] catalogue NOT durably persisted (hasDb=${hasDb}, dbOk=${dbOk}, fileOk=${fileOk})`,
    );
  }
  return durable;
}
