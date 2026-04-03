// repositories/candidateTestSubmission.repository.js
const AssessmentReview = require("../models/assessmentReview.model.js");

class AssessmentReviewRepository {
  async create(data) {
    const submission = new AssessmentReview(data);
    return await submission.save();
  }

  async findAllPaginated({ page, limit, sort, search }) {
    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { emailAddress: { $regex: search, $options: "i" } },
        { googleDriveLink: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [assessmentReviewsRaw, total] = await Promise.all([
      AssessmentReview.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({ path: "userId", select: "attachments.resume_url" })
        .populate({ path: "reviewerId", select: "fullName email role" })
        .lean(),
      AssessmentReview.countDocuments(filter),
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
        .populate({ path: "reviewerId", select: "fullName email role" })
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
    return await AssessmentReview.findById(id)
      .populate({ path: "reviewerId", select: "fullName email role" })
      .lean();
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
    })
      .populate({ path: "reviewerId", select: "fullName email role" })
      .lean();
  }

  async delete(id) {
    return await AssessmentReview.findByIdAndDelete(id);
  }
}

module.exports = new AssessmentReviewRepository();
