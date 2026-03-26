const AssessmentReviewService = require("../services/assessmentreview.service");
const ResponseClass = require("../utils/response-handler");

const BRITISH_COUNCIL_BANDS = [
  { grade: "Pre-A1", level: "Beginner", min: 0, max: 99 },
  { grade: "A1", level: "Elementary", min: 100, max: 199 },
  { grade: "A2", level: "Pre Intermediate", min: 200, max: 299 },
  { grade: "B1", level: "Intermediate", min: 300, max: 399 },
  { grade: "B2", level: "Upper Intermediate", min: 400, max: 499 },
  { grade: "C1", level: "Advanced", min: 500, max: 599 },
];

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
      const submissions = await AssessmentReviewService.getAllSubmissions({
        page,
        limit,
        sort: { createdAt: -1 },
        search,
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
        reviewerComment,
        reviewRating,
      } = req.body;
      const payload = {
        ...(fullName && { fullName }),
        ...(emailAddress && { emailAddress }),
        ...(dateOfSubmission && { dateOfSubmission }),
        ...(timeOfSubmission && { timeOfSubmission }),
        ...(submissionStatus && { submissionStatus }),
        ...(englishTestScore && { englishTestScore }),
        ...(problemSolvingScore && { problemSolvingScore }),
        ...(googleDriveLink && { googleDriveLink }),
        ...(encounteredIssues && { encounteredIssues }),
        ...(issueDescription && { issueDescription }),
        ...(instructionClarityRating && { instructionClarityRating }),
        ...(reviewerComment && { reviewerComment }),
        ...(reviewRating && { reviewRating }),
      };

      // Automatically assign the authenticated user's ID as the reviewer
      if (
        req.body.reviewerComment !== undefined ||
        req.body.reviewRating !== undefined
      ) {
        payload.reviewerId = req.user?.userId;
      }

      payload.reviewStatus = "Reviewed";
      // If both component scores are present, compute total and attach to reviewRating
      const hasEnglishScore = req.body.englishTestScore !== undefined;
      const hasProblemScore = req.body.problemSolvingScore !== undefined;
      if (hasEnglishScore && hasProblemScore) {
        const englishScore = Number(req.body.englishTestScore);
        const problemScore = Number(req.body.problemSolvingScore);
        if (Number.isFinite(englishScore) && Number.isFinite(problemScore)) {
          const totalScore = englishScore + problemScore;
          const band = BRITISH_COUNCIL_BANDS.find(
            (b) => totalScore >= b.min && totalScore <= b.max,
          );

          payload.reviewRating = {
            ...(payload.reviewRating || {}),
            score: totalScore,
            ...(band ? { grade: band.grade, level: band.level } : {}),
          };
        }
      }

      const submission = await AssessmentReviewService.updateSubmission(
        req.params.id,
        payload,
      );
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
