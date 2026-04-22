// Layer: Service
/**
 * Visitor Service
 * Contains all business logic for visitor validation
 */

const { isValidEmailFormat } = require("../utils/emailvalidator");
const surveyUserRepository = require("../repositories/surveyUser.repository");

class VisitorService {
  /**
   * Validate visitor email
   * Checks if the email is valid and if the visitor is registered
   * @param {string} email - Email to validate
   * @returns {Promise<Object>} Validation result with success flag
   * @throws {Object} Error object with status code and message
   */
  async validateVisitor(email) {
    // Validate email is provided
    if (!email) {
      throw {
        status: 400,
        message: "Email is required",
      };
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!isValidEmailFormat(normalizedEmail)) {
      throw {
        status: 400,
        message: "Invalid email format",
      };
    }

    // Check if user exists in database
    const user = await surveyUserRepository.findByEmail(normalizedEmail);

    if (user) {
      return {
        success: true,
        message: "Visitor validated",
      };
    } else {
      // User not found - throw with 403 status
      throw {
        status: 403,
        message: "Email not recognized",
      };
    }
  }
}

module.exports = new VisitorService();
