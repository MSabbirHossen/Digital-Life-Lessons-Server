import validator from "validator";

// Lesson validation schema
export const validateLesson = (data) => {
  const errors = [];

  // Title validation
  if (!data.title || data.title.trim().length < 3) {
    errors.push("Title must be at least 3 characters");
  }
  if (data.title && data.title.length > 200) {
    errors.push("Title must be less than 200 characters");
  }

  // Description validation
  if (!data.description || data.description.trim().length < 10) {
    errors.push("Description must be at least 10 characters");
  }
  if (data.description && data.description.length > 5000) {
    errors.push("Description must be less than 5000 characters");
  }

  // Category validation
  const validCategories = [
    "Personal Growth",
    "Career",
    "Relationships",
    "Health",
    "Finance",
    "Spirituality",
    "Learning",
    "Other",
  ];
  if (!validCategories.includes(data.category)) {
    errors.push("Invalid category");
  }

  // Emotional tone validation
  const validTones = [
    "Inspiring",
    "Thoughtful",
    "Cautionary",
    "Joyful",
    "Reflective",
    "Humorous",
    "Profound",
  ];
  if (!validTones.includes(data.emotionalTone)) {
    errors.push("Invalid emotional tone");
  }

  // Image URL validation
  if (
    data.imageURL &&
    data.imageURL.trim() &&
    !validator.isURL(data.imageURL)
  ) {
    errors.push("Invalid image URL");
  }

  // Visibility validation
  if (data.visibility && !["Public", "Private"].includes(data.visibility)) {
    errors.push("Invalid visibility setting");
  }

  // Access level validation
  if (data.accessLevel && !["Free", "Premium"].includes(data.accessLevel)) {
    errors.push("Invalid access level");
  }

  return errors;
};

// User profile validation
export const validateUserProfile = (data) => {
  const errors = [];

  if (data.name && (data.name.trim().length < 2 || data.name.length > 100)) {
    errors.push("Name must be between 2 and 100 characters");
  }

  if (
    data.photoURL &&
    data.photoURL.trim() &&
    !validator.isURL(data.photoURL)
  ) {
    errors.push("Invalid photo URL");
  }

  return errors;
};

// Comment validation
export const validateComment = (data) => {
  const errors = [];

  if (!data.comment || data.comment.trim().length < 1) {
    errors.push("Comment cannot be empty");
  }
  if (data.comment && data.comment.length > 1000) {
    errors.push("Comment must be less than 1000 characters");
  }

  return errors;
};

// Report validation
export const validateReport = (data) => {
  const errors = [];

  const validReasons = [
    "Inappropriate Content",
    "Hate Speech or Harassment",
    "Misleading or False Information",
    "Spam or Promotional Content",
    "Sensitive or Disturbing Content",
    "Other",
  ];

  if (!validReasons.includes(data.reason)) {
    errors.push("Invalid report reason");
  }

  if (data.description && data.description.length > 500) {
    errors.push("Description must be less than 500 characters");
  }

  return errors;
};

// Middleware to sanitize and validate lesson data
export const validateLessonMiddleware = (req, res, next) => {
  const errors = validateLesson(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // ✅ Sanitize input
  req.body.title = req.body.title?.trim() || "";
  req.body.description = req.body.description?.trim() || "";
  req.body.imageURL = req.body.imageURL?.trim() || "";

  next();
};

export const validateCommentMiddleware = (req, res, next) => {
  const errors = validateComment(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // ✅ Sanitize comment
  req.body.comment = validator.trim(req.body.comment);

  next();
};

export const validateUserProfileMiddleware = (req, res, next) => {
  const errors = validateUserProfile(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  if (req.body.name) req.body.name = validator.trim(req.body.name);
  if (req.body.photoURL) req.body.photoURL = validator.trim(req.body.photoURL);

  next();
};

export const validateReportMiddleware = (req, res, next) => {
  const errors = validateReport(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // ✅ Sanitize description
  if (req.body.description) {
    req.body.description = validator.trim(req.body.description);
  }

  next();
};
