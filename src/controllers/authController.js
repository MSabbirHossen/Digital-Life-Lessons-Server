import User from "../models/User.js";
import admin from "../config/firebase.js";

// Register or update user in database
export const registerUser = async (req, res) => {
  try {
    const { uid, name, email, photoURL } = req.body;

    if (!uid || !name || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({
        uid,
        name,
        email,
        photoURL: photoURL || "",
      });
      await user.save();
      return res
        .status(201)
        .json({ message: "User created successfully", user });
    }

    // Update existing user
    user.name = name;
    user.photoURL = photoURL || user.photoURL;
    await user.save();

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select("-__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user by ID (for public profile)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email photoURL lessonsCreated createdAt",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { name, photoURL } = req.body;
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (photoURL) user.photoURL = photoURL;

    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error" });
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
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User promoted to admin", user });
  } catch (error) {
    console.error("Error promoting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users (admin only, with pagination)
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const users = await User.find().skip(skip).limit(limit).select("-__v");

    res.json({
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};
