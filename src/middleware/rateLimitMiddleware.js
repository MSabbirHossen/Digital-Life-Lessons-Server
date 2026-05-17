import rateLimit from "express-rate-limit";

// ✅ General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ✅ Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
  },
  skipSuccessfulRequests: false,
});

// ✅ Lesson creation rate limiter
export const lessonCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 lessons per hour
  message: {
    success: false,
    message: "Too many lesson creations, please try again later",
  },
  skipSuccessfulRequests: false,
});

// ✅ Stripe webhook limiter (allow many, only limit to prevent abuse)
export const stripeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 per minute (very generous for webhooks)
  message: { success: false, message: "Too many webhook requests" },
  skipSuccessfulRequests: true,
});

// ✅ Comment creation rate limiter
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments per minute
  message: {
    success: false,
    message: "Too many comments, please try again later",
  },
});

// ✅ Report submission rate limiter
export const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 reports per day per IP
  message: { success: false, message: "Too many reports, try again tomorrow" },
});
