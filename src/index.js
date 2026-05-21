import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { config } from "./config/config.js";
import { connectDB } from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  generalLimiter,
  stripeLimiter,
} from "./middleware/rateLimitMiddleware.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";

const app = express();

const allowedOrigins = (() => {
  const configuredOrigins = config.clientUrl
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (config.nodeEnv === "production") {
    return [config.primaryClientUrl].filter(Boolean);
  }

  return Array.from(
    new Set([
      ...configuredOrigins,
      "http://localhost:3000",
      "http://localhost:5173",
    ]),
  );
})();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (config.nodeEnv !== "production") {
      console.log("Incoming Origin:", origin);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (config.nodeEnv !== "production") {
      // Development fallback: do not fail local workflows for unexpected local origins.
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// ✅ Security headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (config.nodeEnv !== "test") {
      console.info(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
      );
    }
  });
  next();
});

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ General rate limiting
app.use(generalLimiter);

// Stripe webhook needs raw body - handle before JSON parsing
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeLimiter,
);

// JSON middleware
app.use(express.json({ limit: "10mb" })); // Set body size limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Digital Life Lessons API is running",
    health: "/api/health",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Digital Life Lessons API is running",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      lessons: "/api/lessons",
      publicLessons: "/api/lessons/public",
      stripe: "/api/stripe",
    },
  });
});

app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/stripe", stripeRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "✅ Server is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler (must be last)
app.use(errorHandler);

// Export app for Vercel serverless functions
export default app;

// Start server only if not in serverless environment
if (process.env.VERCEL === undefined) {
  const startServer = async () => {
    try {
      await connectDB();
      app.listen(config.port, () => {
        console.log(`🚀 Server running on port ${config.port}`);
        console.log(`📡 API: http://localhost:${config.port}/api`);
      });
    } catch (error) {
      console.error("Failed to start server:", error.message);
      process.exit(1);
    }
  };

  startServer();
}
