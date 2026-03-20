const assessmentReviewRepository = require("../repositories/assessmentReview.repository");

class AssessmentReviewService {
  async createSubmission(data) {
    // const existing = await assessmentReviewRepository.findByEmail(
    //   data.emailAddress,
    // );
    // if (existing) {
    //   const error = new Error("A submission with this email already exists.");
    //   error.statusCode = 409;
    //   throw error;
    // }

    return await assessmentReviewRepository.create(data);
  }

  async getAllSubmissions({ page, limit, sort }) {
    const { items, total } = await assessmentReviewRepository.findAllPaginated({
      page,
      limit,
      sort,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSubmissionsByUserId({ userId, page, limit, sort }) {
    const { items, total } =
      await assessmentReviewRepository.findByUserIdPaginated({
        userId,
        page,
        limit,
        sort,
      });

    return {
      items,
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
