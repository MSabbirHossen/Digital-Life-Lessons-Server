import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
  },
  { timestamps: true },
);

// Create unique index to prevent duplicate favorites
favoriteSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });
favoriteSchema.index({ lessonId: 1 });

export default mongoose.model("Favorite", favoriteSchema);
