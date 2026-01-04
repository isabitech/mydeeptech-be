import SurveyUser from '../models/surveyuser.model.js';

class SurveyUserRepository {
    async findByEmail(email) {
        return await SurveyUser.findOne({ email: email.toLowerCase() }).exec();
    }

    async findOne(filter) {
        return await SurveyUser.findOne(filter).exec();
    }

    async create(userData) {
        const user = new SurveyUser(userData);
        return await user.save();
    }
}

export default new SurveyUserRepository();
