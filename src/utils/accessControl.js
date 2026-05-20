import User from "../models/User.js";

export const PREMIUM_LOCK_MESSAGE =
  "Premium content is available to Premium members only";

export const PRIVATE_LOCK_MESSAGE = "This lesson is private";

export const toPlainLesson = (lesson) =>
  typeof lesson?.toObject === "function" ? lesson.toObject() : lesson;

export const getDbUserFromRequest = async (req) => {
  if (req.dbUser) return req.dbUser;
  if (!req.user?.uid) return null;

  const user = await User.findOne({ uid: req.user.uid });
  req.dbUser = user;
  return user;
};

export const isLessonOwner = (lesson, user) => {
  if (!lesson || !user) return false;
  const ownerId = lesson.userId?._id || lesson.userId;
  return ownerId?.toString() === user._id.toString();
};

export const isAdmin = (user) => user?.role === "admin";

export const canViewFullLesson = (lesson, user) => {
  if (!lesson) return false;
  if (isAdmin(user) || isLessonOwner(lesson, user)) return true;
  if (lesson.visibility === "Private") return false;
  if (lesson.accessLevel === "Premium") return Boolean(user?.isPremium);
  return true;
};

export const canInteractWithLesson = canViewFullLesson;

export const getLessonAccessBlock = (lesson, user) => {
  if (!lesson) return { blocked: true, status: 404, message: "Lesson not found" };
  if (canViewFullLesson(lesson, user)) return { blocked: false };

  if (lesson.visibility === "Private") {
    return {
      blocked: true,
      status: 403,
      reason: "private",
      message: PRIVATE_LOCK_MESSAGE,
    };
  }

  return {
    blocked: true,
    status: 403,
    reason: "premium",
    message: PREMIUM_LOCK_MESSAGE,
  };
};

export const makeLessonPreview = (lesson, user) => {
  const plain = toPlainLesson(lesson);
  if (canViewFullLesson(lesson, user)) {
    return { lesson: plain, isPremiumBlocked: false, isPrivateBlocked: false };
  }

  if (plain.visibility === "Private") {
    return {
      lesson: null,
      isPremiumBlocked: false,
      isPrivateBlocked: true,
    };
  }

  return {
    lesson: {
      ...plain,
      description: "Premium lesson. Upgrade to read the full reflection.",
      isLockedPreview: true,
    },
    isPremiumBlocked: true,
    isPrivateBlocked: false,
  };
};

export const sanitizeLessonList = (lessons, user) =>
  lessons
    .map((lesson) => makeLessonPreview(lesson, user).lesson)
    .filter(Boolean);
