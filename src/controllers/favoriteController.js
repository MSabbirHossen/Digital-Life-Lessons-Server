import Favorite from "../models/Favorite.js";
import Lesson from "../models/Lesson.js";
import User from "../models/User.js";
import LessonReport from "../models/LessonReport.js";
import { deleteLessonCascade } from "./lessonController.js";
import {
  canInteractWithLesson,
  getDbUserFromRequest,
  sanitizeLessonList,
} from "../utils/accessControl.js";
import { makePagination, parsePagination } from "../utils/queryUtils.js";

export const addFavorite = async (req, res) => {
  const { lessonId } = req.body;
  const [user, lesson] = await Promise.all([
    getDbUserFromRequest(req),
    Lesson.findById(lessonId),
  ]);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }
  if (!canInteractWithLesson(lesson, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to save this lesson",
    });
  }

  try {
    const favorite = await Favorite.create({ userId: user._id, lessonId });
    await Promise.all([
      Lesson.updateOne({ _id: lessonId }, { $inc: { favoritesCount: 1 } }),
      User.updateOne({ _id: user._id }, { $inc: { lessonsSaved: 1 } }),
    ]);

    return res.status(201).json({
      success: true,
      message: "Added to favorites",
      favorite,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Already favorited",
      });
    }
    throw error;
  }
};

export const removeFavorite = async (req, res) => {
  const { lessonId } = req.body;
  const user = await getDbUserFromRequest(req);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
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

  await Promise.all([
    Lesson.updateOne(
      { _id: lessonId, favoritesCount: { $gt: 0 } },
      { $inc: { favoritesCount: -1 } },
    ),
    User.updateOne(
      { _id: user._id, lessonsSaved: { $gt: 0 } },
      { $inc: { lessonsSaved: -1 } },
    ),
  ]);

  return res.json({ success: true, message: "Removed from favorites" });
};

export const getUserFavorites = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, {
    limit: 9,
    maxLimit: 24,
  });
  const user = await getDbUserFromRequest(req);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const lessonFilter = {};
  if (req.query.category) lessonFilter.category = req.query.category;
  if (req.query.tone) lessonFilter.emotionalTone = req.query.tone;
  if (req.query.accessLevel) lessonFilter.accessLevel = req.query.accessLevel;

  const allFavorites = await Favorite.find({ userId: user._id })
    .populate({
      path: "lessonId",
      match: lessonFilter,
      populate: {
        path: "userId",
        select: "name email photoURL lessonsCreated",
      },
    })
    .sort({ createdAt: -1 });

  const filtered = allFavorites
    .filter((favorite) => favorite.lessonId)
    .map((favorite) => ({
      ...favorite.toObject(),
      lessonId: sanitizeLessonList([favorite.lessonId], user)[0],
    }))
    .filter((favorite) => favorite.lessonId);

  return res.json({
    success: true,
    favorites: filtered.slice(skip, skip + limit),
    pagination: makePagination(filtered.length, page, limit),
  });
};

export const isFavorited = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const favorite = await Favorite.findOne({
    userId: user._id,
    lessonId: req.params.lessonId,
  });

  return res.json({ success: true, isFavorited: Boolean(favorite) });
};

export const reportLesson = async (req, res) => {
  const { reason, description } = req.body;
  const [user, lesson] = await Promise.all([
    getDbUserFromRequest(req),
    Lesson.findById(req.params.id),
  ]);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }
  if (lesson.userId.toString() === user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "You cannot report your own lesson",
    });
  }
  if (!canInteractWithLesson(lesson, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to report this lesson",
    });
  }

  try {
    const report = await LessonReport.create({
      lessonId: lesson._id,
      reporterUserId: user._id,
      reason,
      description: description || "",
    });

    return res.status(201).json({
      success: true,
      message: "Lesson reported successfully",
      report,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reported this lesson",
      });
    }
    throw error;
  }
};

export const getAllReports = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, {
    limit: 10,
    maxLimit: 50,
  });

  const [total, reports] = await Promise.all([
    LessonReport.countDocuments(),
    LessonReport.find()
      .populate("lessonId", "title description accessLevel visibility")
      .populate("reporterUserId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return res.json({
    success: true,
    reports,
    pagination: makePagination(total, page, limit),
  });
};

export const deleteReportedLesson = async (req, res) => {
  const lesson = await deleteLessonCascade(req.params.lessonId);
  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  return res.json({
    success: true,
    message: "Reported lesson deleted successfully",
  });
};

export const resolveReport = async (req, res) => {
  const report = await LessonReport.findByIdAndUpdate(
    req.params.reportId,
    { status: "Reviewed" },
    { new: true },
  );

  if (!report) {
    return res
      .status(404)
      .json({ success: false, message: "Report not found" });
  }

  return res.json({
    success: true,
    message: "Report resolved successfully",
    report,
  });
};
