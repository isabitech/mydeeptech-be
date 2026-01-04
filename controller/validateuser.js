import surveyUserService from '../services/surveyUser.service.js';
import ResponseHandler from '../utils/responseHandler.js';
import Joi from 'joi';

class ValidateUserController {
  // SCHEMAS
  static validateVisitorSchema = Joi.object({
    email: Joi.string().email().required().lowercase().trim()
  });

  /**
   * Validate a visitor email against recognized survey users
   * POST /api/validate/visitor
   */
  async validateVisitor(req, res) {
    try {
      const { error, value } = ValidateUserController.validateVisitorSchema.validate(req.body);
      if (error) return ResponseHandler.error(res, error.details[0].message, 400);

      const data = await surveyUserService.validateVisitor(value.email);
      return ResponseHandler.success(res, data, 'Visitor validated');
    } catch (error) {
      return ResponseHandler.handleError(res, error);
    }
  }
}

export default new ValidateUserController();
