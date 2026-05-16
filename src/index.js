import "express-async-errors";
import express from "express";
import cors from "cors";
import { config } from "./config/config.js";
import { connectDB } from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);

// Stripe webhook needs raw body - handle before JSON parsing
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// JSON middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/stripe", stripeRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ message: "✅ Server is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
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
