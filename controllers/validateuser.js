const { isValidEmailFormat } = require("../utils/emailvalidator");
const visitorService = require("../services/visitor.service");

/**
 * Validate visitor email endpoint
 * POST /api/auth/emailValidation
 */
const validateVisitor = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmailFormat(normalizedEmail)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid email format" });
  }

  try {
    await visitorService.validateVisitor(normalizedEmail);
    return res
      .status(200)
      .json({ success: true, message: "Visitor validated" });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    const message = err.message || "Server error";
    return res.status(status).json({ success: false, message });
  }
};

module.exports = { validateVisitor };
