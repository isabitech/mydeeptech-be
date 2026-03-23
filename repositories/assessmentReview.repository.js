// repositories/candidateTestSubmission.repository.js
const AssessmentReview = require("../models/assessmentReview.model.js");

class AssessmentReviewRepository {
  async create(data) {
    const submission = new AssessmentReview(data);
    return await submission.save();
  }

  async findAllPaginated({ page, limit, sort }) {
    const skip = (page - 1) * limit;

    const [assessmentReviews, total] = await Promise.all([
      AssessmentReview.find().sort(sort).skip(skip).limit(limit).lean(),
      AssessmentReview.countDocuments(),
    ]);

    return { assessmentReviews, total };
  }

  async findByUserIdPaginated({ userId, page, limit, sort }) {
    const skip = (page - 1) * limit;

    const [assessmentReviews, total] = await Promise.all([
      AssessmentReview.find({ userId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AssessmentReview.countDocuments({ userId }),
    ]);

    return { assessmentReviews, total };
  }

  async findById(id) {
    return await AssessmentReview.findById(id).lean();
  }

  async findByEmail(email) {
    return await AssessmentReview.findOne({
      emailAddress: email.toLowerCase(),
    }).lean();
  }

  async findByUserId(userId) {
    return await AssessmentReview.find({
      userId: userId,
    }).lean();
  }

  async update(id, data) {
    return await AssessmentReview.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
  }

  async delete(id) {
    return await AssessmentReview.findByIdAndDelete(id);
  }
}

module.exports = new AssessmentReviewRepository();
