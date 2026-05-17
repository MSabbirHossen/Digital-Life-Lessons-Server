import Favorite from "../models/Favorite.js";
import Lesson from "../models/Lesson.js";
import User from "../models/User.js";
import LessonReport from "../models/LessonReport.js";
import { deleteLessonCascade } from "./lessonController.js";

// Add to favorites
export const addFavorite = async (req, res) => {
  try {
    const { lessonId } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ userId: user._id, lessonId });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Already favorited" });
    }

    const favorite = new Favorite({
      userId: user._id,
      lessonId,
    });

    await favorite.save();
    lesson.favoritesCount += 1;
    user.lessonsSaved += 1;
    await Promise.all([lesson.save(), user.save()]);

    res
      .status(201)
      .json({ success: true, message: "Added to favorites", favorite });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Remove from favorites
export const removeFavorite = async (req, res) => {
  try {
    const { lessonId } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const favorite = await Favorite.findOneAndDelete({
      userId: user._id,
      lessonId,
    });

    if (!favorite) {
      return res
        .status(404)
        .json({ success: false, message: "Favorite not found" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (lesson) {
      lesson.favoritesCount = Math.max(0, lesson.favoritesCount - 1);
      await lesson.save();
    }

    user.lessonsSaved = Math.max(0, user.lessonsSaved - 1);
    await user.save();

    res.json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user's favorites
export const getUserFavorites = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 24);
    const skip = (page - 1) * limit;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [total, favorites] = await Promise.all([
      Favorite.countDocuments({ userId: user._id }),
      Favorite.find({ userId: user._id })
        .populate({
          path: "lessonId",
          populate: { path: "userId", select: "name email photoURL" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({
      success: true,
      favorites,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Check if lesson is favorited
export const isFavorited = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const favorite = await Favorite.findOne({ userId: user._id, lessonId });

    res.json({ success: true, isFavorited: !!favorite });
  } catch (error) {
    console.error("Error checking favorite:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Report a lesson
export const reportLesson = async (req, res) => {
  try {
    const { reason, description } = req.body;
    const lessonId = req.params.id;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    // ✅ Check if user already reported this lesson
    const existingReport = await LessonReport.findOne({
      lessonId,
      reporterUserId: user._id,
    });

    if (existingReport) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You have already reported this lesson",
        });
    }

    const report = new LessonReport({
      lessonId,
      reporterUserId: user._id,
      reason,
      description: description || "",
    });

    await report.save();
    res
      .status(201)
      .json({ success: true, message: "Lesson reported successfully", report });
  } catch (error) {
    console.error("Error reporting lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all reports (admin only)
export const getAllReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await LessonReport.countDocuments();
    const reports = await LessonReport.find()
      .populate("lessonId", "title description")
      .populate("reporterUserId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      reports,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete reported lesson (admin)
export const deleteReportedLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await deleteLessonCascade(lessonId);
    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    if (
      lesson.visibility === "Private" &&
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "This lesson is private" });
    }

    if (
      lesson.accessLevel === "Premium" &&
      !user.isPremium &&
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Upgrade to Premium to save this lesson",
      });
    }

    res.json({
      success: true,
      message: "Reported lesson deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reported lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Ignore/Resolve report (admin)
export const resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await LessonReport.findByIdAndUpdate(
      reportId,
      { status: "Reviewed" },
      { new: true },
    );

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    res.json({
      success: true,
      message: "Report resolved successfully",
      report,
    });
  } catch (error) {
    console.error("Error resolving report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
