const envConfig = require("../config/envConfig");

class ResponseClass {

  // ===== Success responses =====
  static Success(res, options = {}) {
    const {
      message = "Operation successful",
      data = {},
      statusCode = 200,
    } = options;

    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static Created(res, options = {}) {
    const {
      message = "Resource created",
      data = {},
      statusCode = 201,
    } = options;

    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  // ===== Base error response ===== 

  static Error(options = {}) {
    const {
      message = "An error occurred",
      data = {},
      statusCode = 500,
      stack,
    } = options;

    const response = {
      success: false,
      message,
      data,
    };

    if (stack && envConfig.NODE_ENV === "development") {
      response.stack = stack;
    }

    return res.status(statusCode).json(response);
  }

  // ===== Error helpers =====

  static BadRequest(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 400,
      message: "Bad Request",
      ...options,
    });
  }

  static Unauthorized(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 401,
      message: "Unauthorized",
      ...options,
    });
  }

  static Forbidden(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 403,
      message: "Forbidden",
      ...options,
    });
  }

  static NotFound(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 404,
      message: "Not Found",
      ...options,
    });
  }

  static Conflict(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 409,
      message: "Conflict",
      ...options,
    });
  }

  static InternalServerError(res, options = {}) {
    return ResponseClass.Error(res, {
      statusCode: 500,
      message: "Internal Server Error",
      ...options,
    });
  }
}

module.exports = ResponseClass;