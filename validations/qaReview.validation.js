const Joi = require('joi');

const reviewTaskSchema = Joi.object({
    submissionId: Joi.string().required(),
    taskIndex: Joi.number().integer().min(0).required(),
    score: Joi.number().min(0).max(10).required(),
    feedback: Joi.string().max(1000).allow('').default(''),
    qualityRating: Joi.string().valid('Excellent', 'Good', 'Fair', 'Poor').default('Good'),
    notes: Joi.string().max(2000).allow('').default('')
});

const finalReviewSchema = Joi.object({
    submissionId: Joi.string().required(),
    overallScore: Joi.number().min(0).max(10).required(),
    overallFeedback: Joi.string().max(2000).allow('').default(''),
    decision: Joi.string().valid('Approve', 'Reject', 'Request Revision').required(),
    privateNotes: Joi.string().max(2000).allow('').default('')
});

const batchReviewSchema = Joi.object({
    submissionIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
    decision: Joi.string().valid('Approve', 'Reject').required(),
    overallFeedback: Joi.string().max(1000).allow('').default('Batch processed')
});

module.exports = {
    reviewTaskSchema,
    finalReviewSchema,
    batchReviewSchema
};
