import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Personal Growth",
        "Career",
        "Relationships",
        "Health",
        "Finance",
        "Spirituality",
        "Learning",
        "Other",
      ],
    },
    emotionalTone: {
      type: String,
      required: true,
      enum: [
        "Inspiring",
        "Thoughtful",
        "Cautionary",
        "Joyful",
        "Reflective",
        "Humorous",
        "Profound",
      ],
    },
    imageURL: {
      type: String,
      default: null,
    },
    visibility: {
      type: String,
      enum: ["Public", "Private"],
      default: "Public",
    },
    accessLevel: {
      type: String,
      enum: ["Free", "Premium"],
      default: "Free",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    favoritesCount: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Lesson", lessonSchema);
