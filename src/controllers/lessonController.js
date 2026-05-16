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
      return res.status(404).json({ message: "User not found" });
    }

    // Validate: only premium users can create premium lessons
    if (accessLevel === "Premium" && !user.isPremium) {
      return res
        .status(403)
        .json({ message: "Only Premium users can create Premium lessons" });
    }

    if (!title || !description || !category || !emotionalTone) {
      return res.status(400).json({ message: "Missing required fields" });
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

    res.status(201).json({ message: "Lesson created successfully", lesson });
  } catch (error) {
    console.error("Error creating lesson:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all public lessons with pagination, search, filter, sort
export const getPublicLessons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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
    res.status(500).json({ message: "Server error" });
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
      return res.status(404).json({ message: "Lesson not found" });
    }

    // Get comments
    const comments = await Comment.find({ lessonId: req.params.id })
      .populate("userId", "name email photoURL")
      .sort({ createdAt: -1 });

    res.json({ lesson, comments });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user's own lessons
export const getUserLessons = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const lessons = await Lesson.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    res.json(lessons);
  } catch (error) {
    console.error("Error fetching user lessons:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update lesson
export const updateLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    // Check authorization
    if (
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this lesson" });
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
          .json({ message: "Only Premium users can set Premium access" });
      }
      lesson.accessLevel = accessLevel;
    }

    await lesson.save();
    res.json({ message: "Lesson updated successfully", lesson });
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete lesson
export const deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    // Check authorization
    if (
      lesson.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this lesson" });
    }

    await Lesson.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ lessonId: req.params.id });
    await Favorite.deleteMany({ lessonId: req.params.id });
    await LessonReport.deleteMany({ lessonId: req.params.id });

    user.lessonsCreated = Math.max(0, user.lessonsCreated - 1);
    await user.save();

    res.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Like/Unlike lesson
export const toggleLike = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    const user = await User.findOne({ uid: req.user.uid });

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const likeIndex = lesson.likes.indexOf(user._id);

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
    res.json({ message: "Like toggled successfully", lesson });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add comment
export const addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ message: "Comment cannot be empty" });
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
      .json({ message: "Comment added successfully", comment: newComment });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get lesson comments
export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ lessonId: req.params.id })
      .populate("userId", "name email photoURL")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const user = await User.findOne({ uid: req.user.uid });

    if (
      comment.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Server error" });
  }
};
