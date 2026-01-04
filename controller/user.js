import { signupSchema, loginSchema } from '../utils/authValidator.js';
import authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { ResponseHandler, ValidationError, NotFoundError } from '../utils/responseHandler.js';

class UserController {
  // Signup controller
  async signup(req, res, next) {
    try {
      const { error } = signupSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const user = await authService.signup(req.body);
      ResponseHandler.success(res, user, 'User registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // Login controller
  async login(req, res, next) {
    try {
      const { error } = loginSchema.validate(req.body);
      if (error) throw new ValidationError(error.details[0].message);

      const { email, password } = req.body;
      const user = await authService.login(email, password);

      ResponseHandler.success(res, { user }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await userRepository.find({ role: req.params.role });
      if (!users || users.length === 0) {
        throw new NotFoundError("No users found for this role");
      }

      ResponseHandler.success(res, users, "Users retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req, res, next) {
    try {
      const query = {};
      if (req.query.role) {
        query.role = req.query.role.toUpperCase();
      }

      const users = await userRepository.find(query);

      if (!users || users.length === 0) {
        throw new NotFoundError("No users found");
      }

      ResponseHandler.success(res, users, "Users retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
export default userController;
