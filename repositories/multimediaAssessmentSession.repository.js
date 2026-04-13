const MultimediaAssessmentSubmission = require('../models/multimediaAssessmentSubmission.model');

class MultimediaAssessmentSessionRepository {
    async findOne(query) {
        return await MultimediaAssessmentSubmission.findOne(query);
    }

    async findById(id) {
        return await MultimediaAssessmentSubmission.findById(id);
    }

    async find(query) {
        return await MultimediaAssessmentSubmission.find(query);
    }

    async countDocuments(query) {
        return await MultimediaAssessmentSubmission.countDocuments(query);
    }

    async create(data) {
        const submission = new MultimediaAssessmentSubmission(data);
        return await submission.save();
    }

    async canUserRetake(annotatorId, assessmentId) {
        return await MultimediaAssessmentSubmission.canUserRetake(annotatorId, assessmentId);
    }

    async findLatestUserAttempt(annotatorId, assessmentId) {
        return await MultimediaAssessmentSubmission.findLatestUserAttempt(annotatorId, assessmentId);
    }

    async updateMany(filter, update) {
        return await MultimediaAssessmentSubmission.updateMany(filter, update);
    }
}

module.exports = new MultimediaAssessmentSessionRepository();
