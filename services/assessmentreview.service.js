const assessmentReviewRepository = require("../repositories/assessmentReview.repository");
const DTUser = require("../models/dtUser.model");

const BRITISH_COUNCIL_BANDS = [
  { grade: "Pre-A1", level: "Beginner", min: 0, max: 99 },
  { grade: "A1", level: "Elementary", min: 100, max: 199 },
  { grade: "A2", level: "Pre Intermediate", min: 200, max: 299 },
  { grade: "B1", level: "Intermediate", min: 300, max: 399 },
  { grade: "B2", level: "Upper Intermediate", min: 400, max: 499 },
  { grade: "C1", level: "Advanced", min: 500, max: 599 },
];

const REVIEW_RATING_PRESETS = {
  "Pre-A1": { score: 99, grade: "Pre-A1", level: "Beginner" },
  A1: { score: 199, grade: "A1", level: "Elementary" },
  A2: { score: 299, grade: "A2", level: "Pre Intermediate" },
  B1: { score: 399, grade: "B1", level: "Intermediate" },
  B2: { score: 499, grade: "B2", level: "Upper Intermediate" },
  C1: { score: 599, grade: "C1", level: "Advanced" },
};

const UPDATE_FIELDS = [
  "fullName",
  "emailAddress",
  "dateOfSubmission",
  "timeOfSubmission",
  "submissionStatus",
  "englishTestScore",
  "problemSolvingScore",
  "googleDriveLink",
  "encounteredIssues",
  "issueDescription",
  "instructionClarityRating",
  "reviewerComment",
  "reviewRating",
];

const pickDefined = (source, allowedKeys) => {
  const output = {};
  allowedKeys.forEach((key) => {
    if (source[key] !== undefined) {
      output[key] = source[key];
    }
  });
  return output;
};

const applyReviewScoring = (payload, body) => {
  const hasEnglishScore = body.englishTestScore !== undefined;
  const hasProblemScore = body.problemSolvingScore !== undefined;
  const englishScore = Number(body.englishTestScore);
  const problemScore = Number(body.problemSolvingScore);
  const scoresAreFinite =
    Number.isFinite(englishScore) && Number.isFinite(problemScore);

  const totalScore =
    hasEnglishScore && hasProblemScore && scoresAreFinite
      ? englishScore + problemScore
      : undefined;

  // Honor explicit reviewRating if provided, but override score with computed total when available.
  if (body.reviewRating !== undefined) {
    if (typeof body.reviewRating === "string") {
      const preset = REVIEW_RATING_PRESETS[body.reviewRating];
      const band =
        totalScore !== undefined
          ? BRITISH_COUNCIL_BANDS.find(
              (b) => totalScore >= b.min && totalScore <= b.max,
            )
          : undefined;

      payload.reviewRating = {
        ...(preset
          ? { grade: preset.grade, level: preset.level }
          : { grade: body.reviewRating }),
        ...(band && totalScore !== undefined
          ? { grade: band.grade, level: band.level }
          : {}),
        ...(totalScore !== undefined
          ? { score: totalScore }
          : preset
            ? { score: preset.score }
            : {}),
      };
      return payload;
    }

    if (body.reviewRating && typeof body.reviewRating === "object") {
      const preset = body.reviewRating.grade
        ? REVIEW_RATING_PRESETS[body.reviewRating.grade]
        : undefined;
      const band =
        totalScore !== undefined
          ? BRITISH_COUNCIL_BANDS.find(
              (b) => totalScore >= b.min && totalScore <= b.max,
            )
          : undefined;

      payload.reviewRating = {
        ...body.reviewRating,
        ...(preset ? { level: preset.level } : {}),
        ...(band && totalScore !== undefined
          ? { grade: band.grade, level: band.level }
          : {}),
        ...(totalScore !== undefined
          ? { score: totalScore }
          : preset
            ? { score: preset.score }
            : {}),
      };
      return payload;
    }
  }

  if (totalScore === undefined) return payload;

  const band = BRITISH_COUNCIL_BANDS.find(
    (b) => totalScore >= b.min && totalScore <= b.max,
  );

  payload.reviewRating = {
    ...(payload.reviewRating || {}),
    score: totalScore,
    ...(band ? { grade: band.grade, level: band.level } : {}),
  };

  return payload;
};

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

  buildUpdatePayload(body, reviewerId) {
    const payload = {
      ...pickDefined(body, UPDATE_FIELDS),
    };

    if (body.reviewerComment !== undefined || body.reviewRating !== undefined) {
      payload.reviewerId = reviewerId;
    }

    payload.reviewStatus = "Reviewed";

    return applyReviewScoring(payload, body);
  }

  async updateSubmissionFromRequest({ id, body, reviewerId }) {
    const payload = this.buildUpdatePayload(body, reviewerId);
    return this.updateSubmission(id, payload);
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
