import User from "../models/User.js";
import { config } from "../config/config.js";
import admin from "../config/firebase.js";
import Lesson from "../models/Lesson.js";
import Favorite from "../models/Favorite.js";
import Comment from "../models/Comment.js";
import LessonReport from "../models/LessonReport.js";
import {
  escapeRegex,
  makePagination,
  parsePagination,
} from "../utils/queryUtils.js";

// Register or update user in database
export const registerUser = async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const { name, photoURL } = req.body;

    if (!uid || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Missing authenticated user data" });
    }

    let user = await User.findOne({ uid });

    if (!user) {
      const newUserData = {
        uid,
        name: name || req.user.name || email.split("@")[0],
        email,
        photoURL: photoURL || "",
      };

      // Auto-promote to admin if email matches configured admin email
      if (
        email &&
        email.toLowerCase() === (config.adminEmail || "").toLowerCase()
      ) {
        newUserData.role = "admin";
      }

      user = new User(newUserData);
      await user.save();
      return res
        .status(201)
        .json({ success: true, message: "User created successfully", user });
    }

    // Update existing user
    if (name) user.name = name;
    user.photoURL = photoURL || user.photoURL;
    await user.save();

    res.json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during registration" });
  }
};

// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select("-__v");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user by ID (for public profile)
export const getUserById = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 24);
    const skip = (page - 1) * limit;
    const sort =
      req.query.sort === "popular" ? { favoritesCount: -1 } : { createdAt: -1 };

    const user = await User.findById(req.params.id).select(
      "name photoURL lessonsCreated createdAt isPremium",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lessonQuery = { userId: user._id, visibility: "Public" };
    const [total, publicLessons, totals] = await Promise.all([
      Lesson.countDocuments(lessonQuery),
      Lesson.find(lessonQuery)
        .populate("userId", "name photoURL lessonsCreated")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Lesson.aggregate([
        { $match: lessonQuery },
        {
          $group: {
            _id: null,
            likes: { $sum: "$likesCount" },
            favorites: { $sum: "$favoritesCount" },
            views: { $sum: "$views" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      user,
      lessons: publicLessons,
      stats: {
        publicLessons: total,
        likes: totals[0]?.likes || 0,
        favorites: totals[0]?.favorites || 0,
        views: totals[0]?.views || 0,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { name, photoURL } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (photoURL) user.photoURL = photoURL;

    await user.save();
    res.json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Promote user to admin (admin only)
export const promoteToAdmin = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { role: "admin" },
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User promoted to admin", user });
  } catch (error) {
    console.error("Error promoting user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Assign any role (admin/moderator/user)
export const assignRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!["user", "admin", "moderator"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, message: "Role updated", user });
  } catch (error) {
    console.error("Error assigning role:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Toggle premium status (admin only)
export const togglePremium = async (req, res) => {
  try {
    const { userId, isPremium } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { isPremium: !!isPremium },
      { new: true },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User premium status updated", user });
  } catch (error) {
    console.error("Error toggling premium:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Set or remove special badge for a user (admin only)
export const setSpecialBadge = async (req, res) => {
  try {
    const { userId, specialBadge } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { specialBadge: !!specialBadge },
      { new: true },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User badge updated", user });
  } catch (error) {
    console.error("Error setting badge:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const lessons = await Lesson.find({ userId }).select("_id");
    const lessonIds = lessons.map((lesson) => lesson._id);
    const favoritesOnDeletedLessons = await Favorite.find({
      lessonId: { $in: lessonIds },
    }).select("userId");
    const usersWhoSavedDeletedLessons = favoritesOnDeletedLessons.map(
      (favorite) => favorite.userId,
    );
    const deletedUserFavorites = await Favorite.find({ userId }).select(
      "lessonId",
    );
    const lessonsSavedByDeletedUser = deletedUserFavorites.map(
      (favorite) => favorite.lessonId,
    );

    await Promise.all([
      Lesson.deleteMany({ userId }),
      Comment.deleteMany({
        $or: [{ userId }, { lessonId: { $in: lessonIds } }],
      }),
      Favorite.deleteMany({
        $or: [{ userId }, { lessonId: { $in: lessonIds } }],
      }),
      LessonReport.deleteMany({
        $or: [{ reporterUserId: userId }, { lessonId: { $in: lessonIds } }],
      }),
      Lesson.updateMany(
        { _id: { $in: lessonsSavedByDeletedUser }, favoritesCount: { $gt: 0 } },
        { $inc: { favoritesCount: -1 } },
      ),
      User.updateMany(
        { _id: { $in: usersWhoSavedDeletedLessons }, lessonsSaved: { $gt: 0 } },
        { $inc: { lessonsSaved: -1 } },
      ),
    ]);

    res.json({
      success: true,
      message: "User and related data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get platform analytics (admin only)
export const getAdminAnalytics = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      totalUsers,
      premiumUsers,
      totalLessons,
      publicLessons,
      privateLessons,
      totalReports,
      activeContributors,
      newLessons,
      featuredLessons,
      topCategories,
      userGrowth,
      lessonGrowth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPremium: true }),
      Lesson.countDocuments(),
      Lesson.countDocuments({ visibility: "Public" }),
      Lesson.countDocuments({ visibility: "Private" }),
      LessonReport.countDocuments(),
      Lesson.distinct("userId", { createdAt: { $gte: since } }).then(
        (ids) => ids.length,
      ),
      Lesson.countDocuments({ createdAt: { $gte: since } }),
      Lesson.countDocuments({ isFeatured: true }),
      Lesson.aggregate([
        { $match: { visibility: "Public" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Lesson.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        totalUsers,
        premiumUsers,
        totalLessons,
        publicLessons,
        privateLessons,
        totalReports,
        activeContributors,
        newLessons,
        featuredLessons,
        topCategories,
        userGrowth,
        lessonGrowth,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all users (admin only, with pagination)
export const getAllUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      limit: 10,
      maxLimit: 50,
    });
    const query = {};
    if (req.query.search) {
      const safeSearch = escapeRegex(
        String(req.query.search).trim().slice(0, 80),
      );
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page,
        limit,
        ...makePagination(total, page, limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
