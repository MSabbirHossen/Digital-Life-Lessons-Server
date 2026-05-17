import Lesson from "../models/Lesson.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Favorite from "../models/Favorite.js";
import LessonReport from "../models/LessonReport.js";

// Create a new lesson
export const createLesson = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      emotionalTone,
      imageURL,
      visibility,
      accessLevel,
    } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Validate: only premium users can create premium lessons
    if (accessLevel === "Premium" && !user.isPremium) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only Premium users can create Premium lessons",
        });
    }

    const lesson = new Lesson({
      userId: user._id,
      title,
      description,
      category,
      emotionalTone,
      imageURL: imageURL || null,
      visibility,
      accessLevel,
    });

    await lesson.save();
    user.lessonsCreated += 1;
    await user.save();

    res
      .status(201)
      .json({ success: true, message: "Lesson created successfully", lesson });
  } catch (error) {
    console.error("Error creating lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all public lessons with pagination, search, filter, sort
export const getPublicLessons = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const search = req.query.search || "";
    const category = req.query.category;
    const tone = req.query.tone;
    const sort = req.query.sort || "newest";

    const skip = (page - 1) * limit;

    // Build query
    const query = { visibility: "Public" };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (tone) {
      query.emotionalTone = tone;
    }

    // Build sort
    let sortObj = {};
    if (sort === "newest") {
      sortObj = { createdAt: -1 };
    } else if (sort === "mostSaved") {
      sortObj = { favoritesCount: -1 };
    } else if (sort === "mostLiked") {
      sortObj = { likesCount: -1 };
    }

    const total = await Lesson.countDocuments(query);
    const lessons = await Lesson.find(query)
      .populate("userId", "name email photoURL lessonsCreated")
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      lessons,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get admin-selected featured lessons for the home page carousel/section
export const getFeaturedLessons = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);
    const lessons = await Lesson.find({
      visibility: "Public",
      isFeatured: true,
    })
      .populate("userId", "name email photoURL lessonsCreated")
      .sort({ updatedAt: -1 })
      .limit(limit);

    res.json({ success: true, lessons });
  } catch (error) {
    console.error("Error fetching featured lessons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: get all lessons with filters, including private and featured content
export const getAdminLessons = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.visibility) query.visibility = req.query.visibility;
    if (req.query.accessLevel) query.accessLevel = req.query.accessLevel;
    if (req.query.featured === "true") query.isFeatured = true;
    if (req.query.featured === "false") query.isFeatured = false;
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [total, lessons, stats] = await Promise.all([
      Lesson.countDocuments(query),
      Lesson.find(query)
        .populate("userId", "name email photoURL lessonsCreated")
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
            featuredLessons: {
              $sum: { $cond: ["$isFeatured", 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      lessons,
      stats: stats[0] || {
        publicLessons: 0,
        privateLessons: 0,
        premiumLessons: 0,
        featuredLessons: 0,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin lessons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: feature/unfeature lessons for home display
export const toggleFeaturedLesson = async (req, res) => {
  try {
    const { isFeatured } = req.body;
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { isFeatured: Boolean(isFeatured) },
      { new: true },
    ).populate("userId", "name email photoURL lessonsCreated");

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    res.json({
      success: true,
      message: lesson.isFeatured
        ? "Lesson featured successfully"
        : "Lesson removed from featured",
      lesson,
    });
  } catch (error) {
    console.error("Error updating featured status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get single lesson details
export const getLessonById = async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true },
    ).populate("userId", "name email photoURL lessonsCreated");

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    // ✅ CHECK PRIVATE LESSON ACCESS
    if (lesson.visibility === "Private") {
      if (!req.user) {
        return res.status(403).json({
          success: false,
          message: "This lesson is private. Please login to view.",
        });
      }

      const user = await User.findOne({ uid: req.user.uid });
      const ownerId = lesson.userId?._id || lesson.userId;
      if (ownerId.toString() !== user._id.toString() && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "This lesson is private",
        });
      }
    }

    // ✅ CHECK PREMIUM LESSON ACCESS
    if (lesson.accessLevel === "Premium" && lesson.visibility === "Public") {
      if (!req.user) {
        // Not authenticated - return lesson with blurred description
        return res.status(200).json({
          success: true,
          lesson: {
            ...lesson.toObject(),
            description: "[Premium Content - Upgrade to view full lesson]",
          },
          comments: [],
          isPremiumBlocked: true,
        });
      }

      const user = await User.findOne({ uid: req.user.uid });
      if (
        !user?.isPremium &&
        (lesson.userId?._id || lesson.userId).toString() !==
          user._id.toString() &&
        user.role !== "admin"
      ) {
        // Free user - return lesson with blurred description
        return res.status(200).json({
          success: true,
          lesson: {
            ...lesson.toObject(),
            description: "[Premium Content - Upgrade to view full lesson]",
          },
          comments: [],
          isPremiumBlocked: true,
        });
      }
    }

    // Get comments
    const comments = await Comment.find({ lessonId: req.params.id })
      .populate("userId", "name email photoURL")
      .sort({ createdAt: -1 });

    res.json({ success: true, lesson, comments });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user's own lessons
export const getUserLessons = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lessons = await Lesson.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    res.json({ success: true, lessons });
  } catch (error) {
    console.error("Error fetching user lessons:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update lesson
export const updateLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    // Check authorization
    if (
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to update this lesson",
        });
    }

    // Update fields
    const {
      title,
      description,
      category,
      emotionalTone,
      imageURL,
      visibility,
      accessLevel,
    } = req.body;

    if (title) lesson.title = title;
    if (description) lesson.description = description;
    if (category) lesson.category = category;
    if (emotionalTone) lesson.emotionalTone = emotionalTone;
    if (imageURL) lesson.imageURL = imageURL;
    if (visibility) lesson.visibility = visibility;
    if (accessLevel) {
      if (
        accessLevel === "Premium" &&
        !user.isPremium &&
        user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Only Premium users can set Premium access",
          });
      }
      lesson.accessLevel = accessLevel;
    }

    await lesson.save();
    res.json({ success: true, message: "Lesson updated successfully", lesson });
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete lesson
export const deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    // Check authorization
    if (
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to delete this lesson",
        });
    }

    const favorites = await Favorite.find({ lessonId: req.params.id }).select(
      "userId",
    );
    const favoriteUserIds = favorites.map((favorite) => favorite.userId);

    await Promise.all([
      Lesson.findByIdAndDelete(req.params.id),
      Comment.deleteMany({ lessonId: req.params.id }),
      Favorite.deleteMany({ lessonId: req.params.id }),
      LessonReport.deleteMany({ lessonId: req.params.id }),
      User.updateOne(
        { _id: lesson.userId, lessonsCreated: { $gt: 0 } },
        { $inc: { lessonsCreated: -1 } },
      ),
      User.updateMany(
        { _id: { $in: favoriteUserIds }, lessonsSaved: { $gt: 0 } },
        { $inc: { lessonsSaved: -1 } },
      ),
    ]);

    res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Like/Unlike lesson
export const toggleLike = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    const user = await User.findOne({ uid: req.user.uid });

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found" });
    }

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
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
        message: "Upgrade to Premium to interact with this lesson",
      });
    }

    const likeIndex = lesson.likes.findIndex(
      (likedUserId) => likedUserId.toString() === user._id.toString(),
    );

    if (likeIndex > -1) {
      // Unlike
      lesson.likes.splice(likeIndex, 1);
      lesson.likesCount = Math.max(0, lesson.likesCount - 1);
    } else {
      // Like
      lesson.likes.push(user._id);
      lesson.likesCount += 1;
    }

    await lesson.save();
    res.json({ success: true, message: "Like toggled successfully", lesson });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add comment
export const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lesson = await Lesson.findById(req.params.id);
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
        message: "Upgrade to Premium to comment on this lesson",
      });
    }

    const newComment = new Comment({
      lessonId: req.params.id,
      userId: user._id,
      comment,
    });

    await newComment.save();
    await newComment.populate("userId", "name email photoURL");

    res
      .status(201)
      .json({
        success: true,
        message: "Comment added successfully",
        comment: newComment,
      });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get lesson comments
export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ lessonId: req.params.id })
      .populate("userId", "name email photoURL")
      .sort({ createdAt: -1 });

    res.json({ success: true, comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    if (
      comment.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to delete this comment",
        });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteLessonCascade = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return null;

  const favorites = await Favorite.find({ lessonId }).select("userId");
  const favoriteUserIds = favorites.map((favorite) => favorite.userId);

  await Promise.all([
    Lesson.findByIdAndDelete(lessonId),
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
