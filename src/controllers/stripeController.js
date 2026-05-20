import Stripe from "stripe";
import { config } from "../config/config.js";
import User from "../models/User.js";
import WebhookLog from "../models/WebhookLog.js";

const stripe = new Stripe(config.stripe.secretKey);

// Create checkout session
export const createCheckoutSession = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.isPremium) {
      return res
        .status(400)
        .json({ success: false, message: "User is already premium" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "bdt",
            product_data: {
              name: "Digital Life Lessons - Premium Membership",
              description: "Lifetime access to all premium lessons",
            },
            unit_amount: 150000, // 1500 BDT in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${config.primaryClientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.primaryClientUrl}/payment/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        uid: user.uid,
      },
    });

    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create checkout session" });
  }
};

// Read-only payment verification. Premium upgrades are applied only by webhook.
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "Session ID required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }

    res.json({
      success: true,
      paid: true,
      message: "Payment completed. Premium activation is handled by webhook.",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to verify payment" });
  }
};

// ✅ IMPROVED: Webhook for Stripe events with idempotency
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ✅ Check if webhook already processed (idempotency)
    const existingLog = await WebhookLog.findOne({ stripeEventId: event.id });

    if (existingLog && existingLog.processed) {
      console.log(`⚠️ Webhook ${event.id} already processed, skipping...`);
      return res.json({ received: true, alreadyProcessed: true });
    }

    // ✅ Handle checkout session completion
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // ✅ Verify payment status before updating
      if (session.payment_status === "paid") {
        const userId = session.metadata?.userId;
        if (!userId) {
          throw new Error("Stripe session missing userId metadata");
        }

        try {
          const user = await User.findByIdAndUpdate(
            userId,
            {
              isPremium: true,
              stripeCustomerId: session.customer || null,
              stripeSessionId: session.id,
            },
            { new: true },
          );

          if (!user) {
            throw new Error(`User not found for Stripe metadata userId ${userId}`);
          }

          // ✅ Log successful webhook processing
          await WebhookLog.create({
            stripeEventId: event.id,
            eventType: event.type,
            userId: user._id,
            processed: true,
            metadata: {
              sessionId: session.id,
              email: user.email,
            },
          });

          console.log(`✅ User ${user.email} upgraded to Premium via webhook`);
        } catch (userError) {
          // ✅ Log failed webhook processing
          await WebhookLog.create({
            stripeEventId: event.id,
            eventType: event.type,
            processed: false,
            error: userError.message,
          });
          throw userError;
        }
      }
    }

    res.json({ received: true, success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res
      .status(500)
      .json({ success: false, message: "Webhook processing error" });
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, isPremium: user.isPremium });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
