import mongoose from "mongoose";

const lessonReportSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Inappropriate Content",
        "Hate Speech or Harassment",
        "Misleading or False Information",
        "Spam or Promotional Content",
        "Sensitive or Disturbing Content",
        "Other",
      ],
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Deleted"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

// ✅ Add database indexes for query optimization
lessonReportSchema.index({ lessonId: 1 });
lessonReportSchema.index({ reporterUserId: 1 });
lessonReportSchema.index(
  { lessonId: 1, reporterUserId: 1 },
  { unique: true },
);
lessonReportSchema.index({ status: 1 });
lessonReportSchema.index({ createdAt: -1 });

export default mongoose.model("LessonReport", lessonReportSchema);
