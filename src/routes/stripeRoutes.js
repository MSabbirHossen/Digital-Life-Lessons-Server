import express from "express";
import * as stripeController from "../controllers/stripeController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create checkout session
router.post(
  "/create-checkout-session",
  verifyToken,
  stripeController.createCheckoutSession,
);

// Verify payment
router.post("/verify-payment", verifyToken, stripeController.verifyPayment);

// Get payment status
router.get("/payment-status", verifyToken, stripeController.getPaymentStatus);

// Webhook (no auth needed - Stripe signature verification instead)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeController.handleStripeWebhook,
);

export default router;
