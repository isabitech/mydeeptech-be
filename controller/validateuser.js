import surveyUserService from '../services/surveyUser.service.js';
import { ResponseHandler, ValidationError } from '../utils/responseHandler.js';
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
    const { error, value } = ValidateUserController.validateVisitorSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const data = await surveyUserService.validateVisitor(value.email);
    ResponseHandler.success(res, data, 'Visitor validated');
  }
}

export default new ValidateUserController();
