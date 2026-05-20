export const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parsePagination = (query, defaults = {}) => {
  const defaultLimit = defaults.limit || 10;
  const maxLimit = defaults.maxLimit || 50;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit,
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const makePagination = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
});
