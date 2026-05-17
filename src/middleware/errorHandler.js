export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  // ✅ Never expose internal error details to client
  res.status(status).json({
    success: false,
    message: status === 500 ? "Server error" : message,
  });
};
