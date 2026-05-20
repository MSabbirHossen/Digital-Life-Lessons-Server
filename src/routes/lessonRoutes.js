import express from "express";
import * as lessonController from "../controllers/lessonController.js";
import * as favoriteController from "../controllers/favoriteController.js";
import {
  optionalVerifyToken,
  verifyToken,
  verifyAdmin,
} from "../middleware/authMiddleware.js";
import {
  validateLessonMiddleware,
  validateCommentMiddleware,
  validateReportMiddleware,
} from "../middleware/validationMiddleware.js";
import {
  lessonCreationLimiter,
  commentLimiter,
  reportLimiter,
} from "../middleware/rateLimitMiddleware.js";
import {
  validateObjectIdBody,
  validateObjectIdParam,
} from "../middleware/validateObjectId.js";

const router = express.Router();

// Public routes for browsing
router.get("/", optionalVerifyToken, lessonController.getPublicLessons);
router.get("/public", optionalVerifyToken, lessonController.getPublicLessons);
router.get("/featured", optionalVerifyToken, lessonController.getFeaturedLessons);

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
  validateObjectIdParam("lessonId"),
  favoriteController.isFavorited,
);
router.post(
  "/favorites/add",
  verifyToken,
  validateObjectIdBody("lessonId"),
  favoriteController.addFavorite,
);
router.post(
  "/favorites/remove",
  verifyToken,
  validateObjectIdBody("lessonId"),
  favoriteController.removeFavorite,
);

// Admin report routes - must come before /:id routes
router.get(
  "/admin/all",
  verifyToken,
  verifyAdmin,
  lessonController.getAdminLessons,
);
router.patch(
  "/admin/:id/featured",
  verifyToken,
  verifyAdmin,
  validateObjectIdParam("id"),
  lessonController.toggleFeaturedLesson,
);
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
  validateObjectIdParam("reportId"),
  favoriteController.resolveReport,
);
router.delete(
  "/admin/reports/:lessonId/delete",
  verifyToken,
  verifyAdmin,
  validateObjectIdParam("lessonId"),
  favoriteController.deleteReportedLesson,
);

// Lesson specific routes - with validation and rate limiting
router.post(
  "/",
  verifyToken,
  lessonCreationLimiter,
  validateLessonMiddleware,
  lessonController.createLesson,
);
router.get(
  "/:id/similar",
  optionalVerifyToken,
  validateObjectIdParam("id"),
  lessonController.getSimilarLessons,
);
router.get(
  "/:id",
  optionalVerifyToken,
  validateObjectIdParam("id"),
  lessonController.getLessonById,
);
router.get(
  "/:id/comments",
  optionalVerifyToken,
  validateObjectIdParam("id"),
  lessonController.getComments,
);
router.put(
  "/:id",
  verifyToken,
  validateObjectIdParam("id"),
  validateLessonMiddleware,
  lessonController.updateLesson,
);
router.delete(
  "/:id",
  verifyToken,
  validateObjectIdParam("id"),
  lessonController.deleteLesson,
);
router.post(
  "/:id/like",
  verifyToken,
  validateObjectIdParam("id"),
  lessonController.toggleLike,
);
router.post(
  "/:id/comment",
  verifyToken,
  validateObjectIdParam("id"),
  commentLimiter,
  validateCommentMiddleware,
  lessonController.addComment,
);
router.delete(
  "/:id/comment/:commentId",
  verifyToken,
  validateObjectIdParam("id", "commentId"),
  lessonController.deleteComment,
);

// Reports - with validation and rate limiting
router.post(
  "/:id/report",
  verifyToken,
  validateObjectIdParam("id"),
  reportLimiter,
  validateReportMiddleware,
  favoriteController.reportLesson,
);

export default router;
