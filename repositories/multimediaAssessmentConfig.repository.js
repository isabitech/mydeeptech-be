const MultimediaAssessmentConfig = require('../models/multimediaAssessmentConfig.model');

class MultimediaAssessmentConfigRepository {
    async findOne(query) {
        return await MultimediaAssessmentConfig.findOne(query);
    }

    async create(data) {
        const config = new MultimediaAssessmentConfig(data);
        return await config.save();
    }

    async findPaginated(matchConditions, sort, skip, limit) {
        return await MultimediaAssessmentConfig.find(matchConditions)
            .populate('projectId', 'projectName projectDescription status')
            .populate('createdBy', 'fullName email')
            .populate('lastModifiedBy', 'fullName email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));
    }

    async countDocuments(query) {
        return await MultimediaAssessmentConfig.countDocuments(query);
    }

    async findById(id) {
        return await MultimediaAssessmentConfig.findById(id)
            .populate('projectId', 'projectName projectDescription status budget')
            .populate('createdBy', 'fullName email')
            .populate('lastModifiedBy', 'fullName email');
    }

    async findByIdToUpdate(id) {
        return await MultimediaAssessmentConfig.findById(id);
    }

    async getByProject(projectId) {
        return await MultimediaAssessmentConfig.getByProject(projectId);
    }
}

module.exports = new MultimediaAssessmentConfigRepository();
