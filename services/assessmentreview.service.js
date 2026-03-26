const assessmentReviewRepository = require("../repositories/assessmentReview.repository");
const DTUser = require("../models/dtUser.model");

class AssessmentReviewService {
  async createSubmission(data) {
    const existing = await assessmentReviewRepository.findByUserId(data.userId);
    if (existing) {
      const error = new Error("A submission with this user ID already exists.");
      error.statusCode = 409;
      throw error;
    }
    const assessmentSubmission = await assessmentReviewRepository.create(data);
    if (assessmentSubmission) {
      await DTUser.findByIdAndUpdate(data.userId, {
        assessmentSubmission: true,
      });
    }
    return assessmentSubmission;
  }

  async getAllSubmissions({ page, limit, sort, search }) {
    const { assessmentReviews, total } =
      await assessmentReviewRepository.findAllPaginated({
        page,
        limit,
        sort,
        search,
      });

    return {
      assessmentReviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSubmissionsByUserId({ userId, page, limit, sort }) {
    const { assessmentReviews, total } =
      await assessmentReviewRepository.findByUserIdPaginated({
        userId,
        page,
        limit,
        sort,
      });

    return {
      assessmentReviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSubmissionById(id) {
    const submission = await assessmentReviewRepository.findById(id);
    if (!submission) {
      const error = new Error("Submission not found.");
      error.statusCode = 404;
      throw error;
    }
    return submission;
  }

  async updateSubmission(id, data) {
    const submission = await assessmentReviewRepository.findById(id);
    if (!submission) {
      const error = new Error("Submission not found.");
      error.statusCode = 404;
      throw error;
    }

    return await assessmentReviewRepository.update(id, data);
  }

  async deleteSubmission(id) {
    const submission = await assessmentReviewRepository.findById(id);
    if (!submission) {
      const error = new Error("Submission not found.");
      error.statusCode = 404;
      throw error;
    }

    await assessmentReviewRepository.delete(id);
    return { message: "Submission deleted successfully." };
  }
}

module.exports = new AssessmentReviewService();
