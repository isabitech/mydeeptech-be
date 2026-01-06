import surveyUserRepository from '../repositories/surveyUser.repository.js';
import { isValidEmailFormat } from '../utils/emailvalidator.js';
import { ValidationError, ForbiddenError } from '../utils/responseHandler.js';

class SurveyUserService {
    async validateVisitor(email) {
        if (!email) {
            throw new ValidationError('Email is required');
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!isValidEmailFormat(normalizedEmail)) {
            throw new ValidationError('Invalid email format');
        }

        const user = await surveyUserRepository.findByEmail(normalizedEmail);

        if (user) {
            return { validated: true };
        } else {
            throw new ForbiddenError('Email not recognized');
        }
    }
}

export default new SurveyUserService();
