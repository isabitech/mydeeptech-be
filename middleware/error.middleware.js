const envConfig = require("../config/envConfig");

const formatErrorMessage = (error) => {
  // Handle Mongoose duplicate key error first
  if (error?.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = Object.values(error.keyValue)[0];
    return `${field} "${value}" already exists.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  if (error && typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
};

const errorMiddleware = (err, _req, res, _next) => {
  if (envConfig.NODE_ENV === "development") {
    console.error("Error =>", err);
  }

  // Use 409 Conflict for duplicate key errors
  const statusCode = err?.code === 11000 ? 409 : err.statusCode || 500;

  return res.status(statusCode).json({
    message: formatErrorMessage(err) || "Internal Server Error",
    statusCode,
    data: err.data || {},
  });
};

module.exports = errorMiddleware;