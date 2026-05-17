import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processed: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: null,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    // Auto-delete webhooks after 30 days
    expires: 2592000,
  },
);

export default mongoose.model("WebhookLog", webhookLogSchema);
