const AiInterviewSession = require("../models/aiInterviewSession.model");
const {
  ACTIVE_SESSION_STATUSES,
  FINAL_DECISIONS,
} = require("../services/ai-interview/constants");

class AiInterviewSessionRepository {
  create(payload) {
    const session = new AiInterviewSession(payload);
    return session.save();
  }

  save(session) {
    return session.save();
  }

  findById(id) {
    return AiInterviewSession.findById(id);
  }

  findOne(filter = {}) {
    return AiInterviewSession.findOne(filter);
  }

  findLatestUnfinished(candidateId, trackId) {
    return AiInterviewSession.findOne({
      candidateId,
      trackId,
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).sort({ updatedAt: -1 });
  }

  findLatestProjectApplicationSession(candidateId, projectId) {
    return AiInterviewSession.findOne({
      candidateId,
      projectId,
      sessionSource: "project-application",
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).sort({ updatedAt: -1 });
  }

  findAllByCandidate(candidateId) {
    return AiInterviewSession.find({ candidateId }).sort({ createdAt: -1 });
  }

  findAdminSessions(filter = {}) {
    return AiInterviewSession.find(filter).sort({ createdAt: -1 });
  }

  aggregate(pipeline = []) {
    return AiInterviewSession.aggregate(pipeline);
  }

  countDocuments(filter = {}) {
    return AiInterviewSession.countDocuments(filter);
  }

  findRecentCompletedScores(limit = 100) {
    return AiInterviewSession.find({
      status: { $in: FINAL_DECISIONS },
      "result.score": { $ne: null },
    })
      .select("result.score completedAt")
      .sort({ completedAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new AiInterviewSessionRepository();
