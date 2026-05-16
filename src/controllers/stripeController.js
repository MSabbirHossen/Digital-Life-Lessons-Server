import Stripe from "stripe";
import { config } from "../config/config.js";
import User from "../models/User.js";

const stripe = new Stripe(config.stripe.secretKey);

// Create checkout session
export const createCheckoutSession = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isPremium) {
      return res.status(400).json({ message: "User is already premium" });
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
      success_url: `${config.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.clientUrl}/payment/cancel`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        uid: user.uid,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
};

// Verify payment and update user status
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const userId = session.metadata.userId;
    const user = await User.findByIdAndUpdate(
      userId,
      { isPremium: true },
      { new: true },
    );

    res.json({ message: "Payment verified successfully", user });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Failed to verify payment" });
  }
};

// Webhook for Stripe events
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.payment_status === "paid") {
        const userId = session.metadata.userId;

        const user = await User.findByIdAndUpdate(
          userId,
          { isPremium: true },
          { new: true },
        );

        console.log(`✅ User ${user.email} upgraded to Premium via webhook`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ message: "Webhook processing error" });
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ isPremium: user.isPremium });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
