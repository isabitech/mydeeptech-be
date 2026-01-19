import { signupSchema, loginSchema } from '../utils/authValidator.js';
import authService from '../services/auth.service.js';
import userRepository from '../repositories/user.repository.js';
import { ResponseHandler, ValidationError, NotFoundError } from '../utils/responseHandler.js';

class UserController {
  // Signup controller
  async signup(req, res) {
    const { error } = signupSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const user = await authService.signup(req.body);
    ResponseHandler.success(res, user, 'User registered successfully', 201);
  }

  // Login controller
  async login(req, res) {
    const { error } = loginSchema.validate(req.body);
    if (error) throw new ValidationError(error.details[0].message);

    const { email, password } = req.body;
    const user = await authService.login(email, password);

    ResponseHandler.success(res, { user }, 'Login successful');
  }

  async getAllUsers(req, res) {
    const users = await userRepository.find({ role: req.params.role });
    if (!users || users.length === 0) {
      throw new NotFoundError("No users found for this role");
    }

    ResponseHandler.success(res, users, "Users retrieved successfully");
  }

  async getUsers(req, res) {
    const query = {};
    if (req.query.role) {
      query.role = req.query.role.toUpperCase();
    }

    const users = await userRepository.find(query);

    if (!users || users.length === 0) {
      throw new NotFoundError("No users found");
    }

    ResponseHandler.success(res, users, "Users retrieved successfully");
  }
}

export const userController = new UserController();
export default userController;
