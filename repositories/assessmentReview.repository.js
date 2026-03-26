// repositories/candidateTestSubmission.repository.js
const AssessmentReview = require("../models/assessmentReview.model.js");

class AssessmentReviewRepository {
  async create(data) {
    const submission = new AssessmentReview(data);
    return await submission.save();
  }

  async findAllPaginated({ page, limit, sort }) {
    const skip = (page - 1) * limit;

    const [assessmentReviewsRaw, total] = await Promise.all([
      AssessmentReview.find()
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({ path: "userId", select: "attachments.resume_url" })
        .lean(),
      AssessmentReview.countDocuments(),
    ]);

    const assessmentReviews = assessmentReviewsRaw.map((review) => {
      const resumeUrl = review?.userId?.attachments?.resume_url || "";
      const normalizedUserId = review?.userId?._id || review.userId;

      return {
        ...review,
        userId: normalizedUserId,
        resume_url: resumeUrl,
      };
    });

    return { assessmentReviews, total };
  }

  async findByUserIdPaginated({ userId, page, limit, sort }) {
    const skip = (page - 1) * limit;

    const [assessmentReviewsRaw, total] = await Promise.all([
      AssessmentReview.find({ userId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({ path: "userId", select: "attachments.resume_url" })
        .lean(),
      AssessmentReview.countDocuments({ userId }),
    ]);

    const assessmentReviews = assessmentReviewsRaw.map((review) => {
      const resumeUrl = review?.userId?.attachments?.resume_url || "";
      const normalizedUserId = review?.userId?._id || review.userId;

      return {
        ...review,
        userId: normalizedUserId,
        resume_url: resumeUrl,
      };
    });

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
    // Return a single submission to allow simple existence checks
    return await AssessmentReview.findOne({ userId }).lean();
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
