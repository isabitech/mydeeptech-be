// Layer: Repository
/**
 * SurveyUser Repository
 * Handles all database interactions for survey users
 */

const SurveyUser = require("../models/surveyuser.model");

class SurveyUserRepository {
  /**
   * Find a user by email
   * @param {string} email - The normalized email address
   * @returns {Promise<Object|null>} User document or null if not found
   */
  async findByEmail(email) {
    return SurveyUser.findOne({ email });
  }

  /**
   * Create a new survey user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user document
   */
  async create(userData) {
    const user = new SurveyUser(userData);
    return user.save();
  }
}

module.exports = new SurveyUserRepository();
