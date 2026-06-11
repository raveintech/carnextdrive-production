import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  createCheckoutSession,
  getCheckoutStatus,
  stripeWebhook,
  getCarPricing,
} from "./routes/stripe";
import {
  uploadHandler,
  uploadMiddleware,
  notifyHandler,
} from "./routes/notifications";
import {
  adminLogin,
  requireAdmin,
  listCars,
  createCar,
  updateCar,
  deleteCar,
} from "./routes/admin";
import { getStoreHealth } from "./catalog/store";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());

  // Stripe webhook MUST be registered BEFORE express.json() so we get the raw body
  app.post(
    "/api/stripe-webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Catalogue store health — confirms whether the durable DB is connected.
  app.get("/api/health", async (_req, res) => {
    try {
      res.json(await getStoreHealth());
    } catch (err) {
      res
        .status(500)
        .json({ error: (err as any)?.message || "health check failed" });
    }
  });

  // Stripe Checkout (subscriptions: weekly or monthly)
  app.post("/api/create-checkout-session", createCheckoutSession);
  app.get("/api/checkout-status/:sessionId", getCheckoutStatus);
  app.get("/api/cars", getCarPricing);

  // Cloudinary uploads + Formspree notifications
  app.post("/api/upload", uploadMiddleware, uploadHandler);
  app.post("/api/notify/:sessionId", notifyHandler);

  // ── Admin (password-gated catalogue management) ──
  app.post("/api/admin/login", adminLogin);
  app.get("/api/admin/cars", requireAdmin, listCars);
  app.post("/api/admin/cars", requireAdmin, createCar);
  app.put("/api/admin/cars/:id", requireAdmin, updateCar);
  app.delete("/api/admin/cars/:id", requireAdmin, deleteCar);

  return app;
}
