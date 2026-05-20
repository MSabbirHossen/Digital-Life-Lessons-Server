import mongoose from "mongoose";

export const validateObjectIdParam =
  (...paramNames) =>
  (req, res, next) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !mongoose.isValidObjectId(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName}`,
        });
      }
    }

    next();
  };

export const validateObjectIdBody =
  (...fieldNames) =>
  (req, res, next) => {
    for (const fieldName of fieldNames) {
      const value = req.body[fieldName];
      if (value && !mongoose.isValidObjectId(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${fieldName}`,
        });
      }
    }

    next();
  };
