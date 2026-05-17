import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

// ✅ Add database indexes for query optimization
commentSchema.index({ lessonId: 1 });
commentSchema.index({ userId: 1 });
commentSchema.index({ createdAt: -1 });

export default mongoose.model("Comment", commentSchema);
