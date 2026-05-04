const Joi = require("joi");
const aiInterviewService = require("../services/aiInterview.service");
const { FINAL_DECISIONS } = require("../services/ai-interview/constants");

const startSessionSchema = Joi.object({
  candidateId: Joi.string().optional(),
  candidateName: Joi.string().allow("").optional(),
  candidateEmail: Joi.string().email().optional(),
  trackId: Joi.string().required(),
  languageCode: Joi.string().default("en-US"),
  targetRole: Joi.string().allow("").optional(),
  resumeName: Joi.string().allow("").optional(),
  resumeAssetId: Joi.string().allow("").optional(),
  projectApplicationId: Joi.string().allow("").optional(),
});

const saveDraftSchema = Joi.object({
  sessionId: Joi.string().optional(),
  draftAnswer: Joi.string().allow("").required(),
});

const submitAnswerSchema = Joi.object({
  sessionId: Joi.string().optional(),
  answer: Joi.string().trim().required(),
});

const focusEventsSchema = Joi.object({
  sessionId: Joi.string().optional(),
  events: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().trim().required(),
        type: Joi.string()
          .valid("tab-hidden", "window-blur")
          .required(),
        occurredAt: Joi.date().iso().required(),
        label: Joi.string().allow("").required(),
      }),
    )
    .required(),
});

const scheduleInterviewSchema = Joi.object({
  candidateName: Joi.string().required(),
  candidateEmail: Joi.string().email().required(),
  trackId: Joi.string().required(),
  languageCode: Joi.string().default("en-US"),
  targetRole: Joi.string().allow("").optional(),
  resumeName: Joi.string().allow("").optional(),
});

const decisionSchema = Joi.object({
  sessionId: Joi.string().optional(),
  status: Joi.string()
    .valid(...FINAL_DECISIONS)
    .required(),
});

const noteSchema = Joi.object({
  note: Joi.string().trim().required(),
});

function sendSuccess(res, statusCode, message, payload, alias = "") {
  const body = {
    success: true,
    message,
    data: payload,
  };

  if (alias) {
    body[alias] = payload;
  } else if (payload && !Array.isArray(payload) && typeof payload === "object") {
    Object.assign(body, payload);
  }

  return res.status(statusCode).json(body);
}

function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
  });
}

function validateBody(schema, body) {
  return schema.validate(body, { abortEarly: false, stripUnknown: true });
}

function handleServiceResult(res, result, successMessage, alias = "") {
  if (result.status >= 400) {
    switch (result.reason) {
      case "user_not_found":
        return sendError(res, result.status, "User not found");
      case "admin_not_found":
        return sendError(res, result.status, "Admin user not found");
      case "candidate_not_found":
        return sendError(
          res,
          result.status,
          "Candidate not found in DTUser records",
        );
      case "track_not_found":
        return sendError(res, result.status, "Interview track not found");
      case "session_not_found":
        return sendError(res, result.status, "Interview session not found");
      case "resume_asset_not_found":
        return sendError(res, result.status, "Resume asset not found");
      case "project_application_not_found":
        return sendError(
          res,
          result.status,
          "Project application not found for this AI interview session",
        );
      case "resume_asset_forbidden":
        return sendError(
          res,
          result.status,
          "You do not have access to that resume asset",
        );
      case "session_completed":
        return sendError(
          res,
          result.status,
          "This interview session has already been completed",
        );
      case "question_not_found":
        return sendError(
          res,
          result.status,
          "No active question is available for this session",
        );
      case "file_required":
        return sendError(res, result.status, "Resume file is required");
      default:
        return sendError(
          res,
          result.status || 500,
          result.message || "AI interview request failed",
        );
    }
  }

  return sendSuccess(
    res,
    result.status || 200,
    successMessage,
    result.payload,
    alias,
  );
}

class AiInterviewController {
  static async getCandidateOverview(req, res) {
    try {
      const result = await aiInterviewService.getCandidateOverview({
        userId: req.user.userId,
      });
      return handleServiceResult(
        res,
        result,
        "AI interview overview retrieved successfully",
      );
    } catch (error) {
      console.error("Error retrieving AI interview overview:", error);
      return sendError(
        res,
        500,
        "Server error retrieving AI interview overview",
        { error: error.message },
      );
    }
  }

  static async getTracks(req, res) {
    try {
      const result = await aiInterviewService.listTracks({
        userId: req.user.userId,
      });
      return handleServiceResult(
        res,
        result,
        "AI interview tracks retrieved successfully",
        "tracks",
      );
    } catch (error) {
      console.error("Error retrieving AI interview tracks:", error);
      return sendError(res, 500, "Server error retrieving AI interview tracks", {
        error: error.message,
      });
    }
  }

  static async getTrack(req, res) {
    try {
      const result = await aiInterviewService.getTrack({
        userId: req.user.userId,
        trackId: req.params.trackId,
      });
      return handleServiceResult(
        res,
        result,
        "AI interview track retrieved successfully",
        "track",
      );
    } catch (error) {
      console.error("Error retrieving AI interview track:", error);
      return sendError(res, 500, "Server error retrieving AI interview track", {
        error: error.message,
      });
    }
  }

  static async startSession(req, res) {
    try {
      const { error, value } = validateBody(startSessionSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.startSession({
        userId: req.user.userId,
        body: value,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview session ready",
        "session",
      );
    } catch (error) {
      console.error("Error starting AI interview session:", error);
      
      // Handle AI service errors with user-friendly messages
      if (error.code === 'AI_RATE_LIMIT') {
        return sendError(res, 429, error.message, {
          code: 'AI_RATE_LIMIT',
          retryAfter: error.retryAfter
        });
      }
      
      if (error.code === 'AI_SERVICE_ERROR') {
        return sendError(res, 503, error.message, {
          code: 'AI_SERVICE_ERROR'
        });
      }
      
      return sendError(res, 500, "Server error starting AI interview session", {
        error: error.message,
      });
    }
  }

  static async getSession(req, res) {
    try {
      const result = await aiInterviewService.getSessionForCandidate({
        userId: req.user.userId,
        sessionId: req.params.sessionId,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview session retrieved successfully",
        "session",
      );
    } catch (error) {
      console.error("Error retrieving AI interview session:", error);
      return sendError(
        res,
        500,
        "Server error retrieving AI interview session",
        { error: error.message },
      );
    }
  }

  static async saveDraft(req, res) {
    try {
      const { error, value } = validateBody(saveDraftSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.saveDraft({
        userId: req.user.userId,
        sessionId: req.params.sessionId,
        draftAnswer: value.draftAnswer,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview draft saved successfully",
        "session",
      );
    } catch (error) {
      console.error("Error saving AI interview draft:", error);
      return sendError(res, 500, "Server error saving AI interview draft", {
        error: error.message,
      });
    }
  }

  static async submitAnswer(req, res) {
    try {
      const { error, value } = validateBody(submitAnswerSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.submitAnswer({
        userId: req.user.userId,
        sessionId: req.params.sessionId,
        answer: value.answer,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview answer submitted successfully",
        "session",
      );
    } catch (error) {
      console.error("Error submitting AI interview answer:", error);
      
      // Handle AI service errors with user-friendly messages
      if (error.code === 'AI_RATE_LIMIT') {
        return sendError(res, 429, error.message, {
          code: 'AI_RATE_LIMIT',
          retryAfter: error.retryAfter
        });
      }
      
      if (error.code === 'AI_SERVICE_ERROR') {
        return sendError(res, 503, error.message, {
          code: 'AI_SERVICE_ERROR'
        });
      }
      
      return sendError(res, 500, "Server error submitting AI interview answer", {
        error: error.message,
      });
    }
  }

  static async submitFocusLossEvents(req, res) {
    try {
      const { error, value } = validateBody(focusEventsSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.submitFocusLossEvents({
        userId: req.user.userId,
        sessionId: req.params.sessionId,
        events: value.events,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview focus-loss events submitted successfully",
        "session",
      );
    } catch (error) {
      console.error("Error submitting AI interview focus-loss events:", error);
      return sendError(
        res,
        500,
        "Server error submitting AI interview focus-loss events",
        { error: error.message },
      );
    }
  }

  static async getResult(req, res) {
    try {
      const result = await aiInterviewService.getResult({
        userId: req.user.userId,
        sessionId: req.params.sessionId,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview result retrieved successfully",
        "session",
      );
    } catch (error) {
      console.error("Error retrieving AI interview result:", error);
      return sendError(res, 500, "Server error retrieving AI interview result", {
        error: error.message,
      });
    }
  }

  static async uploadResume(req, res) {
    try {
      const result = await aiInterviewService.uploadResume({
        userId: req.user.userId,
        file: req.file,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview resume uploaded successfully",
      );
    } catch (error) {
      console.error("Error uploading AI interview resume:", error);
      return sendError(res, 500, "Server error uploading AI interview resume", {
        error: error.message,
      });
    }
  }

  static async getAdminOverview(req, res) {
    try {
      const result = await aiInterviewService.getAdminOverview();
      return handleServiceResult(
        res,
        result,
        "Admin AI interview overview retrieved successfully",
      );
    } catch (error) {
      console.error("Error retrieving admin AI interview overview:", error);
      return sendError(
        res,
        500,
        "Server error retrieving admin AI interview overview",
        { error: error.message },
      );
    }
  }

  static async getAdminSessions(req, res) {
    try {
      const result = await aiInterviewService.getAdminSessions({
        query: req.query,
      });

      return handleServiceResult(
        res,
        result,
        "Admin AI interview sessions retrieved successfully",
        "sessions",
      );
    } catch (error) {
      console.error("Error retrieving admin AI interview sessions:", error);
      return sendError(
        res,
        500,
        "Server error retrieving admin AI interview sessions",
        { error: error.message },
      );
    }
  }

  static async getAdminReport(req, res) {
    try {
      const result = await aiInterviewService.getAdminReport({
        sessionId: req.params.sessionId,
      });

      return handleServiceResult(
        res,
        result,
        "Admin AI interview report retrieved successfully",
      );
    } catch (error) {
      console.error("Error retrieving admin AI interview report:", error);
      return sendError(
        res,
        500,
        "Server error retrieving admin AI interview report",
        { error: error.message },
      );
    }
  }

  static async scheduleInterview(req, res) {
    try {
      const { error, value } = validateBody(scheduleInterviewSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.scheduleInterview({
        adminUserId: req.admin.userId,
        body: value,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview scheduled successfully",
        "session",
      );
    } catch (error) {
      console.error("Error scheduling AI interview:", error);
      return sendError(res, 500, "Server error scheduling AI interview", {
        error: error.message,
      });
    }
  }

  static async updateAdminDecision(req, res) {
    try {
      const { error, value } = validateBody(decisionSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.updateAdminDecision({
        adminUserId: req.admin.userId,
        sessionId: req.params.sessionId,
        status: value.status,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview decision updated successfully",
        "session",
      );
    } catch (error) {
      console.error("Error updating AI interview decision:", error);
      return sendError(res, 500, "Server error updating AI interview decision", {
        error: error.message,
      });
    }
  }

  static async updateAdminNote(req, res) {
    try {
      const { error, value } = validateBody(noteSchema, req.body);
      if (error) {
        return sendError(res, 400, "Validation failed", {
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await aiInterviewService.updateAdminNote({
        adminUserId: req.admin.userId,
        sessionId: req.params.sessionId,
        note: value.note,
      });

      return handleServiceResult(
        res,
        result,
        "AI interview note updated successfully",
      );
    } catch (error) {
      console.error("Error updating AI interview note:", error);
      return sendError(res, 500, "Server error updating AI interview note", {
        error: error.message,
      });
    }
  }
}

module.exports = AiInterviewController;
