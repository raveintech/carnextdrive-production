/**
 * Admin API — password-gated management of car listings & pricing.
 *
 * Auth model (stateless, no DB required):
 *   POST /api/admin/login { password }  -> { token }
 *   The token is an HMAC-signed, time-limited bearer credential. Every write
 *   endpoint requires `Authorization: Bearer <token>` and re-verifies the
 *   signature server-side, so a leaked token expires on its own and cannot be
 *   forged without the secret.
 *
 * The default password is "admin123" but SHOULD be overridden in production via
 * the ADMIN_PASSWORD env var. Likewise set ADMIN_TOKEN_SECRET to a long random
 * string so tokens can't be forged.
 */

import { RequestHandler } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Car } from "../catalog/data";
import { getCatalog, saveCatalog } from "../catalog/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  process.env.STRIPE_SECRET_KEY || // reuse an existing high-entropy secret if present
  "carnextdrive-admin-secret-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

// ── Token helpers ──────────────────────────────────────────────────────────
function sign(payload: string): string {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("hex");
}

function issueToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = String(exp);
  const token = `${payload}.${sign(payload)}`;
  return Buffer.from(token, "utf8").toString("base64url");
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    if (dot < 0) return false;
    const payload = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const expected = sign(payload);
    // Constant-time compare to avoid signature timing attacks.
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return false;
    }
    const exp = Number(payload);
    return Number.isFinite(exp) && Date.now() < exp;
  } catch {
    return false;
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ── Auth middleware ────────────────────────────────────────────────────────
export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// ── Login ──────────────────────────────────────────────────────────────────
export const adminLogin: RequestHandler = (req, res) => {
  const password = (req.body?.password ?? "") as string;
  if (typeof password !== "string" || !timingSafeStringEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  return res.json({ token: issueToken(), expiresInMs: TOKEN_TTL_MS });
};

// ── Validation ─────────────────────────────────────────────────────────────
const carInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.string().trim().max(60).default(""),
  weekly: z.coerce.number().nonnegative("Weekly price must be ≥ 0").max(1_000_000),
  monthly: z.coerce
    .number()
    .nonnegative("Monthly price must be ≥ 0")
    .max(1_000_000),
  seats: z.coerce.number().int().min(1).max(15).default(5),
  image: z.string().trim().max(2000).default(""),
  imageCredit: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).default(""),
  features: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

function nextId(cars: Car[]): string {
  const max = cars.reduce((m, c) => {
    const n = parseInt(c.id, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return String(max + 1);
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export const listCars: RequestHandler = async (_req, res) => {
  res.json(await getCatalog());
};

export const createCar: RequestHandler = async (req, res) => {
  const parsed = carInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || "Invalid car data" });
  }
  const cars = await getCatalog();
  // zod has validated/defaulted every field at runtime; the cast just settles
  // the input-vs-output inference for the spread.
  const car = { id: nextId(cars), ...parsed.data } as Car;
  const updated = [...cars, car];
  if (!(await saveCatalog(updated))) {
    return res.status(500).json({ error: "Failed to persist catalogue" });
  }
  return res.status(201).json(car);
};

export const updateCar: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const parsed = carInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message || "Invalid car data" });
  }
  const cars = await getCatalog();
  const idx = cars.findIndex((c) => c.id === id);
  if (idx < 0) return res.status(404).json({ error: "Car not found" });

  const car = { ...cars[idx], ...parsed.data, id } as Car;
  const updated = cars.map((c, i) => (i === idx ? car : c));
  if (!(await saveCatalog(updated))) {
    return res.status(500).json({ error: "Failed to persist catalogue" });
  }
  return res.json(car);
};

export const deleteCar: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const cars = await getCatalog();
  if (!cars.some((c) => c.id === id)) {
    return res.status(404).json({ error: "Car not found" });
  }
  const updated = cars.filter((c) => c.id !== id);
  if (!(await saveCatalog(updated))) {
    return res.status(500).json({ error: "Failed to persist catalogue" });
  }
  return res.json({ ok: true });
};
