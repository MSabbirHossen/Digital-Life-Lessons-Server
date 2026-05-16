import express from "express";
import * as lessonController from "../controllers/lessonController.js";
import * as favoriteController from "../controllers/favoriteController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes for browsing
router.get("/public", lessonController.getPublicLessons);

// Protected routes - must come before /:id routes
router.get("/user/my-lessons", verifyToken, lessonController.getUserLessons);

// Favorites routes - must come before /:id routes
router.get(
  "/favorites/my-favorites",
  verifyToken,
  favoriteController.getUserFavorites,
);
router.get(
  "/favorites/check/:lessonId",
  verifyToken,
  favoriteController.isFavorited,
);
router.post("/favorites/add", verifyToken, favoriteController.addFavorite);
router.post(
  "/favorites/remove",
  verifyToken,
  favoriteController.removeFavorite,
);

// Admin report routes - must come before /:id routes
router.get(
  "/admin/reports/all",
  verifyToken,
  verifyAdmin,
  favoriteController.getAllReports,
);
router.post(
  "/admin/reports/:reportId/resolve",
  verifyToken,
  verifyAdmin,
  favoriteController.resolveReport,
);
router.delete(
  "/admin/reports/:lessonId/delete",
  verifyToken,
  verifyAdmin,
  favoriteController.deleteReportedLesson,
);

// Lesson specific routes
router.post("/", verifyToken, lessonController.createLesson);
router.get("/:id", lessonController.getLessonById);
router.get("/:id/comments", lessonController.getComments);
router.put("/:id", verifyToken, lessonController.updateLesson);
router.delete("/:id", verifyToken, lessonController.deleteLesson);
router.post("/:id/like", verifyToken, lessonController.toggleLike);
router.post("/:id/comment", verifyToken, lessonController.addComment);
router.delete(
  "/:id/comment/:commentId",
  verifyToken,
  lessonController.deleteComment,
);

// Reports
router.post("/:id/report", verifyToken, favoriteController.reportLesson);

export default router;
