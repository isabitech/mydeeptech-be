class AppError extends Error {
  constructor(options = {}) {
    const { message, statusCode = 500, data = {} } = options || {};
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;