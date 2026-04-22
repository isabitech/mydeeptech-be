/**
 * responseHandler.js
 *
 * Centralized response helpers for the dtUser controller.
 * Every res.status().json() pattern from the controller lives here.
 * Import what you need — no more inline response shapes scattered around.
 *
 * Usage:
 *   const { notFound, badRequest, forbidden, ok, created } = require("../utils/responseHandler");
 *   return notFound(res, "User not found");
 */

// ─── 2xx ────────────────────────────────────────────────────────────────────

/**
 * 200 OK — generic success with a data payload
 * @param {object} res
 * @param {string} message
 * @param {object} payload  - key/value pairs merged into the response body
 */
const ok = (res, message, payload = {}) => {
  return res.status(200).json({ success: true, message, ...payload });
};

/**
 * 201 Created — resource was created successfully
 * @param {object} res
 * @param {string} message
 * @param {object} payload
 */
const created = (res, message, payload = {}) => {
  return res.status(201).json({ success: true, message, ...payload });
};

// ─── 4xx ────────────────────────────────────────────────────────────────────

/**
 * 400 Bad Request — generic, no reason code
 * @param {object} res
 * @param {string} message
 * @param {object} [extra]  - optional extra fields (e.g. emailResent, requiresPasswordSetup)
 */
const badRequest = (res, message, extra = {}) => {
  return res.status(400).json({ success: false, message, ...extra });
};

/**
 * 400 Bad Request — validation error with a structured errors array
 * Used when result.errors contains field-level validation details
 * @param {object} res
 * @param {string[]} errors
 */
const validationError = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: "Validation error",
    errors,
  });
};

/**
 * 401 Unauthorized
 * @param {object} res
 * @param {string} [message]
 */
const unauthorized = (
  res,
  message = "Invalid credentials or account not verified",
) => {
  return res.status(401).json({ success: false, message });
};

/**
 * 403 Forbidden — generic
 * @param {object} res
 * @param {string} message
 * @param {object} [extra]  - optional fields e.g. { code, currentStatus }
 */
const forbidden = (res, message, extra = {}) => {
  return res.status(403).json({ success: false, message, ...extra });
};

/**
 * 404 Not Found
 * @param {object} res
 * @param {string} [message]
 */
const notFound = (res, message = "Resource not found") => {
  return res.status(404).json({ success: false, message });
};

/**
 * 409 Conflict — resource already exists
 * @param {object} res
 * @param {string} message
 * @param {string} [code]  - optional machine-readable code e.g. "ADMIN_EXISTS"
 */
const conflict = (res, message, code) => {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(409).json(body);
};

/**
 * 429 Too Many Requests
 * @param {object} res
 * @param {string} message
 * @param {string} [code]
 */
const tooManyRequests = (res, message, code) => {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(429).json(body);
};

// ─── 5xx ────────────────────────────────────────────────────────────────────

/**
 * 500 Internal Server Error
 * Always call from inside a catch block — never from a result.status check.
 * @param {object} res
 * @param {string} message  - human-readable context e.g. "Server error during login"
 * @param {Error}  error    - the actual caught Error object
 */
const serverError = (res, message, error) => {
  return res.status(500).json({
    success: false,
    message,
    error: error?.message || error,
  });
};

// ─── Semantic helpers (named after the business reason) ──────────────────────
// These wrap the primitives above and encode the exact message + shape used
// across the controller so call sites are one-liners.

const Errors = {
  // auth / user creation
  userAlreadyExists: (res) =>
    badRequest(res, "User already exists with this email"),

  emailNotVerified: (res, resent = false) =>
    badRequest(
      res,
      resent
        ? "Please verify your email first. A new verification email has been sent to your inbox."
        : "Please verify your email first. Unable to resend verification email at this time.",
      resent ? { emailResent: true } : { emailResent: false },
    ),

  passwordNotSet: (res, userId) =>
    badRequest(res, "Please set up your password first", {
      requiresPasswordSetup: true,
      userId,
    }),

  invalidCredentials: (res) => badRequest(res, "Invalid credentials"),

  emailMismatch: (res) => badRequest(res, "Invalid request"),

  mustVerifyBeforePassword: (res) =>
    badRequest(res, "Email must be verified before setting up password"),

  passwordAlreadySet: (res) =>
    badRequest(res, "Password has already been set. Use login instead."),

  noPasswordSet: (res) =>
    badRequest(
      res,
      "No password is currently set. Please use the setup password endpoint instead.",
      {
        requiresPasswordSetup: true,
      },
    ),

  incorrectOldPassword: (res) =>
    badRequest(res, "Current password is incorrect"),

  samePassword: (res) =>
    badRequest(res, "New password must be different from current password"),

  emailAlreadyVerified: (res) => badRequest(res, "Email is already verified"),

  invalidVerificationLink: (res) =>
    badRequest(res, "Invalid verification link"),

  invalidInvoiceId: (res) => badRequest(res, "Invalid invoice ID"),

  invalidUserId: (res) => badRequest(res, "Invalid user ID format"),

  alreadyApprovedForQA: (res, user) =>
    badRequest(res, "User is already approved for QA status", {
      data: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        currentQAStatus: user.qaStatus,
      },
    }),

  alreadyRejectedForQA: (res, user) =>
    badRequest(res, "User QA status is already rejected", {
      data: {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        currentQAStatus: user.qaStatus,
      },
    }),

  alreadyApprovedForProject: (res) =>
    badRequest(res, "User is already approved for this project"),

  invalidAnnotatorStatus: (res, validStatuses) =>
    badRequest(
      res,
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      {
        validStatuses,
      },
    ),

  invalidRole: (res) => badRequest(res, "Invalid role specified"),

  fileRequired: (res, label = "File") =>
    badRequest(res, `${label} is required. Please upload a file.`),

  // admin
  invalidAdminEmail: (res) =>
    forbidden(
      res,
      "Admin email must end with @mydeeptech.ng or be in approved admin list",
      {
        code: "INVALID_ADMIN_EMAIL",
      },
    ),

  invalidAdminKey: (res) =>
    forbidden(res, "Invalid admin creation key", { code: "INVALID_ADMIN_KEY" }),

  accessDenied: (res) =>
    forbidden(res, "Access denied. You can only update your own profile.", {
      code: "ACCESS_DENIED",
    }),

  notVerifiedAnnotator: (res, currentStatus) =>
    forbidden(res, "Profile updates are only allowed for verified annotators", {
      code: "NOT_VERIFIED",
      currentStatus,
    }),

  notApprovedForProjects: (res) =>
    forbidden(
      res,
      "Access denied. Only approved annotators can view projects.",
    ),

  adminAlreadyExists: (res) =>
    conflict(
      res,
      "Admin account already exists with this email",
      "ADMIN_EXISTS",
    ),

  invoiceNotFound: (res) => notFound(res, "Invoice not found or access denied"),

  verificationNotFound: (res) =>
    notFound(
      res,
      "No verification request found or verification expired",
      "VERIFICATION_NOT_FOUND",
    ),

  otpNotFound: (res) =>
    notFound(
      res,
      "No OTP verification request found or OTP expired",
      "OTP_NOT_FOUND",
    ),

  adminNotFound: (res) =>
    notFound(res, "Admin account not found", "ADMIN_NOT_FOUND"),

  verificationExpired: (res) =>
    badRequest(
      res,
      "Verification code has expired. Please request a new one.",
      {
        code: "VERIFICATION_EXPIRED",
      },
    ),

  invalidVerificationCode: (res, attemptsRemaining) =>
    badRequest(res, "Invalid verification code", {
      code: "INVALID_VERIFICATION_CODE",
      attemptsRemaining,
    }),

  otpExpired: (res) =>
    badRequest(res, "OTP has expired. Please request a new one.", {
      code: "OTP_EXPIRED",
    }),

  invalidOtp: (res, attemptsRemaining) =>
    badRequest(res, "Invalid OTP code", {
      code: "INVALID_OTP",
      attemptsRemaining,
    }),

  tooManyOtpAttempts: (res) =>
    tooManyRequests(
      res,
      "Too many verification attempts. Please request a new verification code.",
      "TOO_MANY_ATTEMPTS",
    ),

  invalidAdminDomain: (res) =>
    badRequest(res, "Invalid credentials or account not verified", {
      code: "INVALID_DOMAIN",
    }),
};

// ─── handleResult ────────────────────────────────────────────────────────────
/**
 * Smart dispatcher — reads result.status + result.reason and fires the right
 * error response automatically. Call it once at the top of any controller
 * function; if it returns true, the error was handled and you should return.
 *
 * Usage:
 *   if (handleResult(res, result)) return;
 *   // safe to use result.user / result.data below
 *
 * @param {object} res     - Express response object
 * @param {object} result  - The object returned by a service call.
 *                           Must have a `status` field. Optionally `reason`,
 *                           `message`, `errors`, `attemptsRemaining`, `user`,
 *                           `userId`, `validStatuses`, `currentStatus`.
 * @returns {boolean}      - true if an error response was sent, false if
 *                           result is a success and the caller should continue.
 */
const handleResult = (res, result) => {
  if (!result || result.status === undefined) return false;

  const { status, reason } = result;

  // ── success — let caller handle the response ──────────────────────────────
  if (status >= 200 && status < 300) return false;

  // ── 400 ───────────────────────────────────────────────────────────────────
  if (status === 400) {
    const reasonMap = {
      validation: () =>
        result.errors
          ? validationError(res, result.errors)
          : badRequest(res, result.message),
      email_mismatch: () => Errors.emailMismatch(res),
      not_verified: () => Errors.mustVerifyBeforePassword(res),
      already_set: () => Errors.passwordAlreadySet(res),
      no_password: () => Errors.noPasswordSet(res),
      invalid_old_password: () => Errors.incorrectOldPassword(res),
      same_password: () => Errors.samePassword(res),
      already_verified: () => Errors.emailAlreadyVerified(res),
      verify_resend_success: () => Errors.emailNotVerified(res, true),
      verify_resend_fail: () => Errors.emailNotVerified(res, false),
      password_not_set: () => Errors.passwordNotSet(res, result.userId),
      invalid_credentials: () => Errors.invalidCredentials(res),
      invalid_id: () => Errors.invalidUserId(res),
      already_approved: () => Errors.alreadyApprovedForQA(res, result.user),
      already_rejected: () => Errors.alreadyRejectedForQA(res, result.user),
      invalid_admin_email: () => Errors.invalidAdminEmail(res),
      verification_expired: () => Errors.verificationExpired(res),
      invalid_verification_code: () =>
        Errors.invalidVerificationCode(res, result.attemptsRemaining),
      otp_expired: () => Errors.otpExpired(res),
      invalid_otp: () => Errors.invalidOtp(res, result.attemptsRemaining),
      file_required: () => Errors.fileRequired(res),
      invalid_annotator_status: () =>
        Errors.invalidAnnotatorStatus(res, result.validStatuses),
      invalid_role: () => Errors.invalidRole(res),
      invalid_invoice_id: () => Errors.invalidInvoiceId(res),
    };

    const handler = reasonMap[reason];
    if (handler) {
      handler();
      return true;
    }

    // fallback — no matching reason, use result.message or a generic message
    badRequest(res, result.message || "Bad request");
    return true;
  }

  // ── 401 ───────────────────────────────────────────────────────────────────
  if (status === 401) {
    unauthorized(res, result.message);
    return true;
  }

  // ── 403 ───────────────────────────────────────────────────────────────────
  if (status === 403) {
    const reasonMap = {
      forbidden: () => Errors.accessDenied(res),
      not_verified: () =>
        Errors.notVerifiedAnnotator(res, result.currentStatus),
      invalid_admin_key: () => Errors.invalidAdminKey(res),
    };

    const handler = reasonMap[reason];
    if (handler) {
      handler();
      return true;
    }

    forbidden(res, result.message || "Forbidden");
    return true;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  if (status === 404) {
    const reasonMap = {
      otp_not_found: () => Errors.otpNotFound(res),
      admin_not_found: () => Errors.adminNotFound(res),
      verification_not_found: () => Errors.verificationNotFound(res),
      invoice_not_found: () => Errors.invoiceNotFound(res),
    };

    const handler = reasonMap[reason];
    if (handler) {
      handler();
      return true;
    }

    notFound(res, result.message || "Resource not found");
    return true;
  }

  // ── 409 ───────────────────────────────────────────────────────────────────
  if (status === 409) {
    Errors.adminAlreadyExists(res);
    return true;
  }

  // ── 429 ───────────────────────────────────────────────────────────────────
  if (status === 429) {
    Errors.tooManyOtpAttempts(res);
    return true;
  }

  // ── unknown non-success status — generic fallback ─────────────────────────
  badRequest(res, result.message || "Unexpected error");
  return true;
};

module.exports = {
  ok,
  created,
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
  handleResult,
  Errors,
};
