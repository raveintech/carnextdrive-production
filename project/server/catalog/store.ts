/**
 * Durable persistence for the car catalogue.
 *
 * Serverless functions (Netlify) have a read-only filesystem except for the
 * ephemeral /tmp dir, so admin edits cannot be written back to source files.
 * We therefore persist the catalogue to:
 *
 *   1. Netlify Blobs  — first-party, durable across deploys & instances. Used
 *      automatically when running inside the Netlify Functions runtime.
 *   2. A local JSON file — used for local/Replit dev (and as a best-effort
 *      fallback on /tmp when Blobs is unavailable).
 *
 * Reads prefer the persisted copy and fall back to the seed data. Once an admin
 * saves, the persisted copy is authoritative.
 */

import { promises as fs } from "fs";
import path from "path";
import { Car, cloneSeed } from "./data";

const BLOB_STORE_NAME = "carnextdrive-catalog";
const BLOB_KEY = "catalog-v1";

// Local file fallback. On Lambda/Netlify only /tmp is writable.
const DATA_DIR = process.env.LAMBDA_TASK_ROOT
  ? "/tmp/carnextdrive-data"
  : path.join(process.cwd(), ".data");
const FILE_PATH = path.join(DATA_DIR, "catalog.json");

// Short-lived in-memory cache so a warm function instance doesn't hit the
// store on every request. Invalidated on writes.
let cache: { cars: Car[]; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

// ── Netlify Blobs (lazily imported so dev without the package still works) ──
async function getBlobStore(): Promise<{
  get: (key: string, opts?: any) => Promise<any>;
  setJSON: (key: string, value: unknown) => Promise<void>;
} | null> {
  try {
    // Dynamic import keeps this optional; esbuild bundles it for the function.
    const mod: any = await import("@netlify/blobs");
    if (!mod?.getStore) return null;
    return mod.getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
  } catch (err) {
    // Not running on Netlify, package unavailable, or Blobs not configured for
    // the site. Log it — silent failure here is what makes admin edits appear
    // to "save" and then revert (they only ever land in ephemeral /tmp).
    console.warn(
      "[catalog] Netlify Blobs unavailable:",
      (err as any)?.message || err,
    );
    return null;
  }
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

async function readFromBlobs(): Promise<Car[] | null> {
  const store = await getBlobStore();
  if (!store) return null;
  try {
    const data = await store.get(BLOB_KEY, { type: "json" });
    return isValidCatalog(data) ? data : null;
  } catch {
    return null;
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

async function writeToBlobs(cars: Car[]): Promise<boolean> {
  const store = await getBlobStore();
  if (!store) return false;
  try {
    await store.setJSON(BLOB_KEY, cars);
    return true;
  } catch (err) {
    console.warn("[catalog] blob write failed:", (err as any)?.message || err);
    return false;
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

/** Returns the full catalogue (persisted copy if present, else seed). */
export async function getCatalog(): Promise<Car[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.cars;
  }
  const cars =
    (await readFromBlobs()) ?? (await readFromFile()) ?? cloneSeed();
  cache = { cars, at: Date.now() };
  return cars;
}

/** Catalogue keyed by id — convenient for lookups (pricing, validation). */
export async function getCatalogMap(): Promise<Record<string, Car>> {
  const cars = await getCatalog();
  return Object.fromEntries(cars.map((c) => [c.id, c]));
}

/**
 * Persist the entire catalogue. Writes to every available backend so the data
 * is durable wherever the app runs. Returns true if at least one backend
 * accepted the write.
 */
export async function saveCatalog(cars: Car[]): Promise<boolean> {
  const blobOk = await writeToBlobs(cars);
  const fileOk = await writeToFile(cars);
  // Update cache regardless so the running instance is immediately consistent.
  cache = { cars, at: Date.now() };

  // On Lambda/Netlify the local file lives on ephemeral /tmp, so a file-only
  // write is NOT durable — it disappears when the function instance recycles,
  // which is why admin edits "revert after some time". Only Netlify Blobs is
  // durable there, so don't report success on a /tmp-only write: let the admin
  // route return a real 500 instead of silently losing the change later.
  const onLambda = Boolean(process.env.LAMBDA_TASK_ROOT);
  const durable = onLambda ? blobOk : blobOk || fileOk;
  if (!durable) {
    console.error(
      `[catalog] catalogue NOT durably persisted (blobOk=${blobOk}, fileOk=${fileOk}, onLambda=${onLambda})`,
    );
  }
  return durable;
}
