import express from "express";
import * as authController from "../controllers/authController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Auth API is running",
    endpoints: {
      register: "POST /api/auth/register",
      me: "GET /api/auth/me",
      updateProfile: "PUT /api/auth/profile",
      userProfile: "GET /api/auth/profile/:id",
    },
  });
});

// Public routes - with rate limiting
router.post("/register", authLimiter, authController.registerUser);

// Protected routes
router.get("/me", verifyToken, authController.getCurrentUser);
router.put("/profile", verifyToken, authController.updateUserProfile);
router.get("/profile/:id", authController.getUserById);
router.get("/user/:id", authController.getUserById);

// Admin routes
router.get(
  "/admin/users",
  verifyToken,
  verifyAdmin,
  authController.getAllUsers,
);
router.get(
  "/admin/analytics",
  verifyToken,
  verifyAdmin,
  authController.getAdminAnalytics,
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
