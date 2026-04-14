const AssessmentReviewService = require("../services/assessmentreview.service");
const ResponseClass = require("../utils/response-handler");

class AssessmentReviewController {
  async create(req, res, next) {
    try {
      const userId = req.user?.userId;
      const {
        fullName,
        emailAddress,
        dateOfSubmission,
        timeOfSubmission,
        submissionStatus,
        englishTestScore,
        problemSolvingScore,
        googleDriveLink,
        encounteredIssues,
        issueDescription,
        instructionClarityRating,
      } = req.body;

      const submission = await AssessmentReviewService.createSubmission({
        userId,
        fullName,
        emailAddress,
        dateOfSubmission,
        timeOfSubmission,
        submissionStatus,
        englishTestScore,
        problemSolvingScore,
        googleDriveLink,
        encounteredIssues,
        issueDescription,
        instructionClarityRating,
      });
      return ResponseClass.Created(res, {
        message: "Submission created successfully",
        data: submission,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 100);
      const search =
        typeof req.query.search === "string" && req.query.search.trim()
          ? req.query.search.trim()
          : undefined;
      const scoreFilter =
        typeof req.query.scoreFilter === "string"
          ? req.query.scoreFilter.toLowerCase()
          : undefined;

      // ✅ NEW: scoreRange parsing
      let minScore, maxScore;

      if (typeof req.query.scoreRange === "string") {
        const parts = req.query.scoreRange.split("-");

        if (parts.length === 2) {
          minScore = Number(parts[0]);
          maxScore = Number(parts[1]);

          if (isNaN(minScore) || isNaN(maxScore)) {
            return res.status(400).json({
              success: false,
              message: "Range must be in format min-max (e.g. 50-80)",
            });
          }
        }
      }

      const submissions = await AssessmentReviewService.getAllSubmissions({
        page,
        limit,
        sort: { createdAt: -1 },
        search,
        scoreFilter,
        minScore,
        maxScore,
      });

      return ResponseClass.Success(res, {
        message: "Submissions fetched successfully",
        data: submissions,
      });
    } catch (error) {
      next(error);
    }
  }
  async getByUserId(req, res, next) {
    try {
      const userId = req.user.userId;
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10) || 20;
      const limit = Math.min(Math.max(limitRaw, 1), 100);
      const submissions = await AssessmentReviewService.getSubmissionsByUserId({
        userId,
        page,
        limit,
        sort: { createdAt: -1 },
      });
      return ResponseClass.Success(res, {
        message: "Submissions fetched successfully",
        data: submissions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const submission = await AssessmentReviewService.getSubmissionById(
        req.params.id,
      );
      return ResponseClass.Success(res, {
        message: "Submission fetched successfully",
        data: submission,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const submission =
        await AssessmentReviewService.updateSubmissionFromRequest({
          id: req.params.id,
          body: req.body,
          reviewerId: req.user?.userId,
        });
      return ResponseClass.Success(res, {
        message: "Submission updated successfully",
        data: submission,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await AssessmentReviewService.deleteSubmission(req.params.id);
      return ResponseClass.Success(res, {
        message: "Submission deleted successfully",
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AssessmentReviewController();
