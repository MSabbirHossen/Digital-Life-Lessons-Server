import Lesson from "../models/Lesson.js";
import Comment from "../models/Comment.js";
import Favorite from "../models/Favorite.js";
import LessonReport from "../models/LessonReport.js";
import User from "../models/User.js";
import {
  canInteractWithLesson,
  getDbUserFromRequest,
  getLessonAccessBlock,
  isAdmin,
  isLessonOwner,
  makeLessonPreview,
  sanitizeLessonList,
} from "../utils/accessControl.js";
import {
  escapeRegex,
  makePagination,
  parsePagination,
} from "../utils/queryUtils.js";

const populateAuthor = "name email photoURL lessonsCreated";

const sortMap = {
  newest: { createdAt: -1 },
  mostSaved: { favoritesCount: -1, createdAt: -1 },
  mostLiked: { likesCount: -1, createdAt: -1 },
};

const buildPublicLessonQuery = (queryParams = {}) => {
  const query = { visibility: "Public" };
  const search = String(queryParams.search || "").trim();

  if (search) {
    const safeSearch = escapeRegex(search.slice(0, 80));
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (queryParams.category) query.category = queryParams.category;
  if (queryParams.tone) query.emotionalTone = queryParams.tone;
  if (queryParams.accessLevel) query.accessLevel = queryParams.accessLevel;
  if (queryParams.excludeId) query._id = { $ne: queryParams.excludeId };

  return query;
};

export const createLesson = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const {
    title,
    description,
    category,
    emotionalTone,
    imageURL,
    visibility = "Public",
    accessLevel = "Free",
  } = req.body;

  if (accessLevel === "Premium" && !user.isPremium && !isAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "Only Premium users can create Premium lessons",
    });
  }

  const lesson = await Lesson.create({
    userId: user._id,
    title,
    description,
    category,
    emotionalTone,
    imageURL: imageURL || null,
    visibility,
    accessLevel,
  });

  await User.updateOne({ _id: user._id }, { $inc: { lessonsCreated: 1 } });
  await lesson.populate("userId", populateAuthor);

  return res.status(201).json({
    success: true,
    message: "Lesson created successfully",
    lesson,
  });
};

export const getPublicLessons = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, {
    limit: 10,
    maxLimit: 50,
  });
  const user = await getDbUserFromRequest(req);
  const query = buildPublicLessonQuery(req.query);
  const sortObj = sortMap[req.query.sort] || sortMap.newest;

  const [total, rawLessons] = await Promise.all([
    Lesson.countDocuments(query),
    Lesson.find(query)
      .populate("userId", populateAuthor)
      .sort(sortObj)
      .skip(skip)
      .limit(limit),
  ]);

  return res.json({
    success: true,
    lessons: sanitizeLessonList(rawLessons, user),
    pagination: makePagination(total, page, limit),
  });
};

export const getFeaturedLessons = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);
  const user = await getDbUserFromRequest(req);
  const rawLessons = await Lesson.find({
    visibility: "Public",
    isFeatured: true,
  })
    .populate("userId", populateAuthor)
    .sort({ updatedAt: -1 })
    .limit(limit);

  return res.json({
    success: true,
    lessons: sanitizeLessonList(rawLessons, user),
  });
};

export const getTopSavedLessons = async (req, res) => {
  const user = await getDbUserFromRequest(req);

  const rawLessons = await Lesson.find({
    visibility: "Public",
    favoritesCount: { $gt: 0 },
  })
    .populate("userId", populateAuthor)
    .sort({ favoritesCount: -1, createdAt: -1 })
    .limit(3);

  return res.json({
    success: true,
    lessons: sanitizeLessonList(rawLessons, user),
  });
};

export const getTopContributorsOfWeek = async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const contributors = await Lesson.aggregate([
    {
      $match: {
        visibility: "Public",
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$userId",
        lessonCount: { $sum: 1 },
        totalSaves: { $sum: "$favoritesCount" },
        totalLikes: { $sum: "$likesCount" },
        latestLessonAt: { $max: "$createdAt" },
      },
    },
    {
      $sort: {
        lessonCount: -1,
        totalSaves: -1,
        totalLikes: -1,
        latestLessonAt: -1,
      },
    },
    { $limit: 3 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: "$user._id",
        name: "$user.name",
        photoURL: "$user.photoURL",
        lessonsCreated: "$user.lessonsCreated",
        lessonCount: 1,
        totalSaves: 1,
        totalLikes: 1,
      },
    },
  ]);

  return res.json({ success: true, contributors });
};

export const getSimilarLessons = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  const currentLesson = await Lesson.findById(req.params.id);
  if (!currentLesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  const rawLessons = await Lesson.find({
    visibility: "Public",
    _id: { $ne: currentLesson._id },
    $or: [
      { category: currentLesson.category },
      { emotionalTone: currentLesson.emotionalTone },
    ],
  })
    .populate("userId", populateAuthor)
    .sort({ createdAt: -1 })
    .limit(6);

  return res.json({
    success: true,
    lessons: sanitizeLessonList(rawLessons, user),
  });
};

export const getAdminLessons = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, {
    limit: 10,
    maxLimit: 50,
  });
  const query = {};

  if (req.query.visibility) query.visibility = req.query.visibility;
  if (req.query.accessLevel) query.accessLevel = req.query.accessLevel;
  if (req.query.featured === "true") query.isFeatured = true;
  if (req.query.featured === "false") query.isFeatured = false;
  if (req.query.search) {
    const safeSearch = escapeRegex(
      String(req.query.search).trim().slice(0, 80),
    );
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [total, lessons, stats] = await Promise.all([
    Lesson.countDocuments(query),
    Lesson.find(query)
      .populate("userId", populateAuthor)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Lesson.aggregate([
      {
        $group: {
          _id: null,
          publicLessons: {
            $sum: { $cond: [{ $eq: ["$visibility", "Public"] }, 1, 0] },
          },
          privateLessons: {
            $sum: { $cond: [{ $eq: ["$visibility", "Private"] }, 1, 0] },
          },
          premiumLessons: {
            $sum: { $cond: [{ $eq: ["$accessLevel", "Premium"] }, 1, 0] },
          },
          featuredLessons: { $sum: { $cond: ["$isFeatured", 1, 0] } },
        },
      },
    ]),
  ]);

  return res.json({
    success: true,
    lessons,
    stats: stats[0] || {
      publicLessons: 0,
      privateLessons: 0,
      premiumLessons: 0,
      featuredLessons: 0,
    },
    pagination: makePagination(total, page, limit),
  });
};

export const toggleFeaturedLesson = async (req, res) => {
  const lesson = await Lesson.findByIdAndUpdate(
    req.params.id,
    { isFeatured: Boolean(req.body.isFeatured) },
    { new: true },
  ).populate("userId", populateAuthor);

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  return res.json({
    success: true,
    message: lesson.isFeatured
      ? "Lesson featured successfully"
      : "Lesson removed from featured",
    lesson,
  });
};

export const getLessonById = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  const lesson = await Lesson.findById(req.params.id).populate(
    "userId",
    populateAuthor,
  );

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  const access = getLessonAccessBlock(lesson, user);
  if (access.blocked && access.reason === "private") {
    return res.status(access.status).json({
      success: false,
      message: access.message,
    });
  }

  await Lesson.updateOne({ _id: lesson._id }, { $inc: { views: 1 } });
  lesson.views = (lesson.views || 0) + 1;

  if (access.blocked && access.reason === "premium") {
    const preview = makeLessonPreview(lesson, user);
    return res.json({
      success: true,
      lesson: preview.lesson,
      comments: [],
      isPremiumBlocked: true,
    });
  }

  const comments = await Comment.find({ lessonId: lesson._id })
    .populate("userId", "name email photoURL")
    .sort({ createdAt: -1 });

  return res.json({ success: true, lesson, comments });
};

export const getUserLessons = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 50);
  const lessons = await Lesson.find({ userId: user._id })
    .populate("userId", populateAuthor)
    .sort({ createdAt: -1 })
    .limit(limit);

  return res.json({ success: true, lessons });
};

export const updateLesson = async (req, res) => {
  const [lesson, user] = await Promise.all([
    Lesson.findById(req.params.id),
    getDbUserFromRequest(req),
  ]);

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  if (!isLessonOwner(lesson, user) && !isAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to update this lesson",
    });
  }

  if (req.body.accessLevel === "Premium" && !user.isPremium && !isAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "Only Premium users can set Premium access",
    });
  }

  const allowedFields = [
    "title",
    "description",
    "category",
    "emotionalTone",
    "imageURL",
    "visibility",
    "accessLevel",
  ];
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      lesson[field] =
        req.body[field] || (field === "imageURL" ? null : req.body[field]);
    }
  }

  await lesson.save();
  await lesson.populate("userId", populateAuthor);

  return res.json({
    success: true,
    message: "Lesson updated successfully",
    lesson,
  });
};

export const deleteLessonCascade = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return null;

  const favorites = await Favorite.find({ lessonId }).select("userId");
  const favoriteUserIds = favorites.map((favorite) => favorite.userId);

  await Promise.all([
    Lesson.deleteOne({ _id: lessonId }),
    Comment.deleteMany({ lessonId }),
    Favorite.deleteMany({ lessonId }),
    LessonReport.deleteMany({ lessonId }),
    User.updateOne(
      { _id: lesson.userId, lessonsCreated: { $gt: 0 } },
      { $inc: { lessonsCreated: -1 } },
    ),
    User.updateMany(
      { _id: { $in: favoriteUserIds }, lessonsSaved: { $gt: 0 } },
      { $inc: { lessonsSaved: -1 } },
    ),
  ]);

  return lesson;
};

export const deleteLesson = async (req, res) => {
  const [lesson, user] = await Promise.all([
    Lesson.findById(req.params.id),
    getDbUserFromRequest(req),
  ]);

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  if (!isLessonOwner(lesson, user) && !isAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to delete this lesson",
    });
  }

  await deleteLessonCascade(req.params.id);
  return res.json({ success: true, message: "Lesson deleted successfully" });
};

export const toggleLike = async (req, res) => {
  const user = await getDbUserFromRequest(req);
  const lesson = await Lesson.findById(req.params.id);

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!canInteractWithLesson(lesson, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to interact with this lesson",
    });
  }

  const alreadyLiked = lesson.likes.some(
    (likedUserId) => likedUserId.toString() === user._id.toString(),
  );

  await Lesson.updateOne(
    { _id: lesson._id },
    alreadyLiked
      ? { $pull: { likes: user._id }, $inc: { likesCount: -1 } }
      : { $addToSet: { likes: user._id }, $inc: { likesCount: 1 } },
  );

  const updatedLesson = await Lesson.findById(lesson._id).populate(
    "userId",
    populateAuthor,
  );

  if (updatedLesson.likesCount < 0) {
    updatedLesson.likesCount = updatedLesson.likes.length;
    await updatedLesson.save();
  }

  return res.json({
    success: true,
    message: alreadyLiked ? "Like removed" : "Lesson liked",
    lesson: updatedLesson,
  });
};

export const addComment = async (req, res) => {
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
  if (!canInteractWithLesson(lesson, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to comment on this lesson",
    });
  }

  const newComment = await Comment.create({
    lessonId: lesson._id,
    userId: user._id,
    comment: req.body.comment,
  });
  await newComment.populate("userId", "name email photoURL");

  return res.status(201).json({
    success: true,
    message: "Comment added successfully",
    comment: newComment,
  });
};

export const getComments = async (req, res) => {
  const [user, lesson] = await Promise.all([
    getDbUserFromRequest(req),
    Lesson.findById(req.params.id),
  ]);

  if (!lesson) {
    return res
      .status(404)
      .json({ success: false, message: "Lesson not found" });
  }
  if (!canInteractWithLesson(lesson, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to these comments",
    });
  }

  const comments = await Comment.find({ lessonId: lesson._id })
    .populate("userId", "name email photoURL")
    .sort({ createdAt: -1 });

  return res.json({ success: true, comments });
};

export const deleteComment = async (req, res) => {
  const [comment, user] = await Promise.all([
    Comment.findById(req.params.commentId),
    getDbUserFromRequest(req),
  ]);

  if (!comment) {
    return res
      .status(404)
      .json({ success: false, message: "Comment not found" });
  }

  if (comment.userId.toString() !== user?._id.toString() && !isAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to delete this comment",
    });
  }

  await Comment.deleteOne({ _id: comment._id });
  return res.json({ success: true, message: "Comment deleted successfully" });
};
