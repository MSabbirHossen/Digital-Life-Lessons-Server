import express from "express";
import * as stripeController from "../controllers/stripeController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Stripe API is running",
    endpoints: {
      createCheckoutSession: "POST /api/stripe/create-checkout-session",
      verifyPayment: "POST /api/stripe/verify-payment",
      paymentStatus: "GET /api/stripe/payment-status",
      webhook: "POST /api/stripe/webhook",
    },
  });
});

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
