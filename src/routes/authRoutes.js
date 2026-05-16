import express from "express";
import * as authController from "../controllers/authController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", authController.registerUser);

// Protected routes
router.get("/me", verifyToken, authController.getCurrentUser);
router.put("/profile", verifyToken, authController.updateUserProfile);
router.get("/user/:id", authController.getUserById);

// Admin routes
router.get(
  "/admin/users",
  verifyToken,
  verifyAdmin,
  authController.getAllUsers,
);
router.post(
  "/admin/promote",
  verifyToken,
  verifyAdmin,
  authController.promoteToAdmin,
);
router.post(
  "/admin/delete-user",
  verifyToken,
  verifyAdmin,
  authController.deleteUser,
);

export default router;
