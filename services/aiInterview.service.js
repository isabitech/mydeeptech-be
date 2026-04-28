const DTUser = require("../models/dtUser.model");
const Resource = require("../models/resource.model");
const AnnotationProject = require("../models/annotationProject.model");
const ProjectApplication = require("../models/projectApplication.model");
const AiInterviewSessionRepository = require("../repositories/aiInterviewSession.repository");
const dtuserUploadService = require("./dtuser-service/dtuser-upload.service");
const groqProvider = require("./ai-interview/groq.provider");
const resumeParserService = require("./ai-interview/resume-parser.service");
const MailService = require("./mail-service/mail-service");
const {
  createApplicationStatusNotification,
} = require("../utils/notificationService");
const {
  buildInterviewerPrompt,
  buildScoringPrompt,
  buildReportPrompt,
  buildFocusLossPrompt,
  buildProjectTrackPrompt,
} = require("./ai-interview/prompts");
const {
  getAiInterviewTracks,
  getAiInterviewTrackById,
  buildProjectTrackId,
  isProjectTrackId,
  extractProjectIdFromTrackId,
  buildProjectTrackFromProject,
  cloneTrack,
} = require("./ai-interview/trackCatalog");
const {
  AI_INTERVIEW_STATUS,
  FINAL_DECISIONS,
  ACTIVE_SESSION_STATUSES,
  ACTIONABLE_STATUSES,
  DIMENSION_METADATA,
  DEFAULT_AI_NAME,
  DETERMINISTIC_PROVIDER,
  AI_AGENTS,
  FOCUS_EVENT_TYPES,
} = require("./ai-interview/constants");

class AiInterviewService {
  constructor(
    sessionRepository = AiInterviewSessionRepository,
    llmProvider = groqProvider,
    resumeService = resumeParserService,
    uploadService = dtuserUploadService,
  ) {
    this.sessionRepository = sessionRepository;
    this.llmProvider = llmProvider;
    this.resumeService = resumeService;
    this.uploadService = uploadService;
    this.rbacEnsured = false;
  }

  async findUserById(userId) {
    return DTUser.findById(userId);
  }

  async findProjectById(projectId) {
    return AnnotationProject.findById(projectId);
  }

  normalizeText(text = "", maxLength = 600) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  clamp(value, min, max, fallback = min) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
  }

  normalizeDate(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  formatDecisionLabel(status) {
    switch (status) {
      case AI_INTERVIEW_STATUS.PASSED:
        return "Passed";
      case AI_INTERVIEW_STATUS.RETRY_REQUIRED:
        return "Retry Required";
      case AI_INTERVIEW_STATUS.ACTION_REQUIRED:
        return "Action Required";
      default:
        return "Pending";
    }
  }

  buildQualificationLabel(score) {
    if (score >= 90) {
      return "Tier 1 Qualified";
    }
    if (score >= 80) {
      return "Qualified";
    }
    if (score >= 65) {
      return "Borderline Qualified";
    }
    return "Needs Further Review";
  }

  buildPercentileLabel(score) {
    if (score >= 90) {
      return "Top 5% of recent applicants this month";
    }
    if (score >= 80) {
      return "Top 20% of recent applicants this month";
    }
    if (score >= 65) {
      return "Above the current baseline for recent applicants";
    }
    return "Below the current benchmark for recent applicants";
  }

  buildNextStep(status) {
    switch (status) {
      case AI_INTERVIEW_STATUS.PASSED:
        return {
          nextStepTitle: "Unlock Higher Earnings",
          nextStepDescription:
            "Your interview has cleared the current baseline. Stay ready for the next workflow or project invitation.",
        };
      case AI_INTERVIEW_STATUS.RETRY_REQUIRED:
        return {
          nextStepTitle: "Retry Recommended",
          nextStepDescription:
            "Review the flagged areas, tighten your examples, and retake the interview when ready.",
        };
      default:
        return {
          nextStepTitle: "Action Needed",
          nextStepDescription:
            "Work on the weak areas called out in your report before attempting another interview.",
        };
    }
  }

  buildRecommendation(status, score) {
    if (status === AI_INTERVIEW_STATUS.PASSED && score >= 85) {
      return "Strong Recommend";
    }
    if (status === AI_INTERVIEW_STATUS.PASSED) {
      return "Recommend";
    }
    if (status === AI_INTERVIEW_STATUS.RETRY_REQUIRED) {
      return "Recommend Retry";
    }
    return "Hold";
  }

  tokenize(text = "") {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2);
  }

  extractKeywords(text = "", limit = 12) {
    const stopWords = new Set([
      "the",
      "and",
      "that",
      "with",
      "from",
      "this",
      "your",
      "into",
      "they",
      "them",
      "have",
      "what",
      "when",
      "where",
      "which",
      "would",
      "could",
      "should",
      "about",
      "then",
      "while",
      "only",
      "were",
      "been",
      "will",
      "their",
      "there",
    ]);

    return [...new Set(this.tokenize(text).filter((item) => !stopWords.has(item)))]
      .slice(0, limit);
  }

  countIntersection(left = [], right = []) {
    const rightSet = new Set(right);
    return left.filter((item) => rightSet.has(item)).length;
  }

  countReasoningMarkers(text = "") {
    const matches = String(text || "").match(
      /\b(because|therefore|since|if|when|tradeoff|trade-off|first|second|then|so|however|edge case|for example)\b/gi,
    );
    return matches ? matches.length : 0;
  }

  buildTrackQuestions(track) {
    return (track.questions || []).map((question) => ({
      id: question.id,
      sectionTitle: question.sectionTitle,
      prompt: question.prompt,
      placeholder: question.placeholder || "",
      tip: question.tip || "",
      suggestedMinutes: question.suggestedMinutes || 0,
      basePrompt: question.prompt,
      generatedByAi: false,
      metadata: {},
    }));
  }

  buildTrackSnapshot(track, questions = []) {
    const snapshot = cloneTrack(track);
    snapshot.questions = this.serializeQuestions(questions);
    return snapshot;
  }

  deriveSpecialization(track, parsedResume = {}, user = null) {
    if (track.specialization) {
      return track.specialization;
    }

    const prioritySkill =
      parsedResume?.keySkills?.find(Boolean) ||
      user?.annotation_skills?.find(Boolean) ||
      user?.domains?.find(Boolean);

    return prioritySkill || track.title;
  }

  buildCandidateContext(user, parsedResume = {}) {
    return {
      id: String(user?._id || ""),
      fullName: user?.fullName || "",
      email: user?.email || "",
      role: user?.role || "",
      annotatorStatus: user?.annotatorStatus || "",
      qaStatus: user?.qaStatus || "",
      domains:
        user?.project_preferences?.domains_of_interest ||
        user?.domains ||
        [],
      yearsOfExperience:
        user?.professional_background?.years_of_experience ||
        parsedResume?.yearsOfExperience ||
        0,
      educationField: user?.professional_background?.education_field || "",
      annotationSkills: user?.annotation_skills || [],
      annotationExperienceTypes:
        user?.professional_background?.annotation_experience_types || [],
      toolExperience: user?.tool_experience || [],
      languages: {
        primaryLanguage: user?.language_proficiency?.primary_language || "",
        englishFluencyLevel:
          user?.language_proficiency?.english_fluency_level || "",
        otherLanguages: user?.language_proficiency?.other_languages || [],
      },
      availability: {
        availableHoursPerWeek:
          user?.personal_info?.available_hours_per_week || 0,
        country: user?.personal_info?.country || "",
        timeZone: user?.personal_info?.time_zone || "",
      },
      parsedResume,
    };
  }

  buildProjectContext(project = {}) {
    const instructionDocuments = Array.isArray(
      project?.projectFiles?.instructionDocuments,
    )
      ? project.projectFiles.instructionDocuments
      : [];
    const sampleData = Array.isArray(project?.projectFiles?.sampleData)
      ? project.projectFiles.sampleData
      : [];
    const guidelineFiles = Array.isArray(project?.projectFiles?.guidelines)
      ? project.projectFiles.guidelines
      : [];

    return {
      id: String(project?._id || project?.id || ""),
      projectName: project?.projectName || "",
      projectDescription: project?.projectDescription || "",
      projectCategory: project?.projectCategory || "",
      difficultyLevel: project?.difficultyLevel || "intermediate",
      estimatedDuration: project?.estimatedDuration || "",
      requiredSkills: project?.requiredSkills || [],
      minimumExperience: project?.minimumExperience || "none",
      languageRequirements: project?.languageRequirements || [],
      tags: project?.tags || [],
      payRate: project?.payRate || 0,
      payRateCurrency: project?.payRateCurrency || "USD",
      payRateType: project?.payRateType || "per_task",
      guidelineLink: project?.projectGuidelineLink || "",
      guidelineVideo: project?.projectGuidelineVideo || "",
      communityLink: project?.projectCommunityLink || "",
      trackerLink: project?.projectTrackerLink || "",
      instructionDocumentNames: instructionDocuments
        .map((item) => item?.originalName)
        .filter(Boolean),
      sampleDataNames: sampleData
        .map((item) => item?.originalName)
        .filter(Boolean),
      guidelineFileNames: guidelineFiles
        .map((item) => item?.originalName)
        .filter(Boolean),
    };
  }

  sanitizeStringList(list, maxItems = 4, maxLength = 180) {
    return (Array.isArray(list) ? list : [])
      .map((item) => this.normalizeText(item, maxLength))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  sanitizeProjectTrackPayload(payload, fallbackTrack) {
    const sectionLabels = this.sanitizeStringList(payload?.sectionLabels, 4, 60);
    const keyInstructions = this.sanitizeStringList(
      payload?.keyInstructions,
      5,
      220,
    );
    const fallbackQuestions = Array.isArray(fallbackTrack.questions)
      ? fallbackTrack.questions
      : [];
    const candidateQuestions = Array.isArray(payload?.questions)
      ? payload.questions
      : [];
    const questions = [];

    for (let index = 0; index < 4; index += 1) {
      const fallbackQuestion =
        fallbackQuestions[index] ||
        fallbackQuestions[fallbackQuestions.length - 1] ||
        {
          id: `${fallbackTrack.id}-q${index + 1}`,
          sectionTitle:
            fallbackTrack.sectionLabels?.[index] || `Section ${index + 1}`,
          prompt: `Question ${index + 1}`,
          placeholder: "Write your answer clearly.",
          tip: "",
          suggestedMinutes: 5,
        };
      const sourceQuestion = candidateQuestions[index] || {};
      const generatedSectionTitle =
        this.normalizeText(sourceQuestion.sectionTitle, 80) ||
        sectionLabels[index] ||
        fallbackQuestion.sectionTitle;

      questions.push({
        id: fallbackQuestion.id || `${fallbackTrack.id}-q${index + 1}`,
        sectionTitle: generatedSectionTitle,
        prompt:
          this.normalizeText(sourceQuestion.prompt, 500) ||
          fallbackQuestion.prompt,
        placeholder:
          this.normalizeText(sourceQuestion.placeholder, 220) ||
          fallbackQuestion.placeholder ||
          "",
        tip:
          this.normalizeText(sourceQuestion.tip, 220) ||
          fallbackQuestion.tip ||
          "",
        suggestedMinutes: this.clamp(
          sourceQuestion.suggestedMinutes,
          3,
          8,
          fallbackQuestion.suggestedMinutes || 5,
        ),
      });
    }

    return {
      ...fallbackTrack,
      title: this.normalizeText(payload?.title, 100) || fallbackTrack.title,
      subtitle:
        this.normalizeText(payload?.subtitle, 140) || fallbackTrack.subtitle,
      summary: this.normalizeText(payload?.summary, 260) || fallbackTrack.summary,
      description:
        this.normalizeText(payload?.description, 900) || fallbackTrack.description,
      keyInstructions:
        keyInstructions.length > 0
          ? keyInstructions
          : fallbackTrack.keyInstructions,
      preparationTip:
        this.normalizeText(payload?.preparationTip, 220) ||
        fallbackTrack.preparationTip,
      progressLabel:
        this.normalizeText(payload?.progressLabel, 220) ||
        fallbackTrack.progressLabel,
      sectionLabels:
        sectionLabels.length === 4
          ? sectionLabels
          : questions.map((question) => question.sectionTitle),
      questions,
    };
  }

  async buildProjectTrack({
    project,
    user = null,
    parsedResume = {},
    useAi = true,
  }) {
    const fallbackTrack = buildProjectTrackFromProject(project);
    if (!useAi) {
      return {
        track: fallbackTrack,
        metadata: {
          agent: AI_AGENTS.PROJECT_TRACK_BUILDER,
          provider: DETERMINISTIC_PROVIDER,
          model: "heuristic-project-track-builder",
          promptVersion: this.llmProvider.getPromptVersion(),
          latencyMs: 0,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
        },
        status: "fallback",
      };
    }

    try {
      const response = await this.llmProvider.generateProjectTrack({
        messages: buildProjectTrackPrompt({
          promptVersion: this.llmProvider.getPromptVersion(),
          projectContext: this.buildProjectContext(project),
          candidateContext: user
            ? this.buildCandidateContext(user, parsedResume)
            : null,
        }),
      });

      return {
        track: this.sanitizeProjectTrackPayload(response.data, fallbackTrack),
        metadata: response.metadata,
        status: "success",
      };
    } catch (error) {
      return {
        track: fallbackTrack,
        metadata: {
          agent: AI_AGENTS.PROJECT_TRACK_BUILDER,
          provider: DETERMINISTIC_PROVIDER,
          model: "heuristic-project-track-builder",
          promptVersion: this.llmProvider.getPromptVersion(),
          latencyMs: 0,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
        },
        status: "fallback",
        errorMessage: error.message,
      };
    }
  }

  serializeQuestions(questions = []) {
    return (questions || []).map((question) => ({
      id: question.id,
      sectionTitle: question.sectionTitle || "",
      prompt: question.prompt,
      placeholder: question.placeholder || "",
      tip: question.tip || "",
      suggestedMinutes: question.suggestedMinutes || 0,
      generatedByAi: Boolean(question.generatedByAi),
    }));
  }

  serializeAnswers(answers = []) {
    return (answers || []).map((answer) => ({
      questionId: answer.questionId,
      questionPrompt: answer.questionPrompt || "",
      sectionTitle: answer.sectionTitle || "",
      answer: answer.answer,
      submittedAt: answer.submittedAt,
      score: answer.score
        ? {
            clarity: answer.score.clarity,
            instructionFidelity: answer.score.instructionFidelity,
            reasoning: answer.score.reasoning,
            domainFit: answer.score.domainFit,
            overallScore: answer.score.overallScore,
            flags: answer.score.flags || [],
            notes: answer.score.notes || "",
          }
        : null,
    }));
  }

  serializeResult(result = null) {
    if (!result) {
      return null;
    }

    return {
      score: result.score,
      status: result.status,
      badgeLabel: result.badgeLabel,
      qualificationLabel: result.qualificationLabel,
      percentileLabel: result.percentileLabel,
      summary: result.summary,
      strengths: result.strengths || [],
      concerns: result.concerns || [],
      nextStepTitle: result.nextStepTitle,
      nextStepDescription: result.nextStepDescription,
      moduleProgress: result.moduleProgress,
      recommendation: result.recommendation,
      confidence: result.confidence,
    };
  }

  serializeFocusLossEvents(events = []) {
    return (events || []).map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      label: event.label || "",
    }));
  }

  serializeFocusLossAssessment(assessment = null) {
    if (!assessment) {
      return null;
    }

    return {
      hasFocusLoss: Boolean(assessment.hasFocusLoss),
      automaticFailure: Boolean(assessment.automaticFailure),
      eventCount: assessment.eventCount || 0,
      distinctEventTypes: assessment.distinctEventTypes || [],
      classification: assessment.classification || "",
      riskLevel: assessment.riskLevel || "none",
      summary: assessment.summary || "",
      recommendation: assessment.recommendation || "",
      concerns: assessment.concerns || [],
      previousStatus: assessment.previousStatus || "",
      previousScore:
        Number.isFinite(Number(assessment.previousScore))
          ? Number(assessment.previousScore)
          : null,
      reviewedAt: assessment.reviewedAt || null,
    };
  }

  serializeSession(session) {
    const track =
      session.trackSnapshot && Object.keys(session.trackSnapshot).length > 0
        ? {
            ...session.trackSnapshot,
            questions: this.serializeQuestions(session.questions),
          }
        : null;

    return {
      id: String(session._id),
      candidateId: String(session.candidateId?._id || session.candidateId),
      sessionSource: session.sessionSource || "catalog",
      projectId: session.projectId ? String(session.projectId) : null,
      projectName: session.projectName || "",
      projectApplicationId: session.projectApplicationId
        ? String(session.projectApplicationId)
        : null,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      trackId: session.trackId,
      trackTitle: session.trackTitle,
      type: session.type,
      languageCode: session.languageCode,
      status: session.status,
      aiName: session.aiName,
      targetRole: session.targetRole,
      specialization: session.specialization,
      resumeName: session.resumeName,
      resumeUrl: session.resumeUrl,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      answers: this.serializeAnswers(session.answers),
      draftAnswer: session.draftAnswer || "",
      applicationContext: session.applicationContext
        ? {
            coverLetter: session.applicationContext.coverLetter || "",
            proposedRate:
              Number.isFinite(Number(session.applicationContext.proposedRate))
                ? Number(session.applicationContext.proposedRate)
                : null,
            availability: session.applicationContext.availability || "",
            estimatedCompletionTime:
              session.applicationContext.estimatedCompletionTime || "",
            submittedAt: session.applicationContext.submittedAt || null,
          }
        : null,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      durationMinutes: session.durationMinutes,
      dimensionScores: session.dimensionScores || [],
      result: this.serializeResult(session.result),
      focusLossEvents: this.serializeFocusLossEvents(session.focusLossEvents),
      focusLossAssessment: this.serializeFocusLossAssessment(
        session.focusLossAssessment,
      ),
      questions: this.serializeQuestions(session.questions),
      track,
    };
  }

  serializeTrack(track) {
    return cloneTrack(track);
  }

  buildContractResponse(data, alias = "") {
    if (!alias && data && !Array.isArray(data) && typeof data === "object") {
      return { data, ...data };
    }

    const response = { data };
    if (alias) {
      response[alias] = data;
    }
    return response;
  }

  aggregateDimensionScores(answers = []) {
    return DIMENSION_METADATA.map((dimension) => {
      const values = (answers || [])
        .map((answer) => Number(answer?.score?.[dimension.key]))
        .filter((value) => Number.isFinite(value));

      const average =
        values.length > 0
          ? Number(
              (
                values.reduce((sum, value) => sum + value, 0) / values.length
              ).toFixed(1),
            )
          : 0;

      return {
        key: dimension.key,
        label: dimension.label,
        score: average,
        note: dimension.note,
      };
    });
  }

  computeAggregateScore(answers = []) {
    const scores = (answers || [])
      .map((answer) => Number(answer?.score?.overallScore))
      .filter((value) => Number.isFinite(value));

    if (!scores.length) {
      return 0;
    }

    return Math.round(
      scores.reduce((sum, value) => sum + value, 0) / scores.length,
    );
  }

  determineDecision(score, dimensionScores = []) {
    const lowestDimension =
      dimensionScores.length > 0
        ? Math.min(...dimensionScores.map((item) => Number(item.score) || 0))
        : 0;

    if (score >= 80 && lowestDimension >= 6) {
      return AI_INTERVIEW_STATUS.PASSED;
    }

    if (score >= 65 && lowestDimension >= 4.5) {
      return AI_INTERVIEW_STATUS.RETRY_REQUIRED;
    }

    return AI_INTERVIEW_STATUS.ACTION_REQUIRED;
  }

  formatFocusEventType(type) {
    switch (type) {
      case "tab-hidden":
        return "tab hidden";
      case "window-blur":
        return "window blur";
      default:
        return String(type || "").trim();
    }
  }

  normalizeFocusLossEvents(events = []) {
    return (Array.isArray(events) ? events : [])
      .map((event, index) => {
        const occurredAt = this.normalizeDate(event?.occurredAt);
        return {
          id:
            this.normalizeText(event?.id, 120) ||
            `focus-event-${index + 1}`,
          type: FOCUS_EVENT_TYPES.includes(event?.type) ? event.type : "",
          occurredAt,
          label: this.normalizeText(event?.label, 220),
        };
      })
      .filter((event) => event.id && event.type && event.occurredAt)
      .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  }

  mergeFocusLossEvents(existingEvents = [], incomingEvents = []) {
    const merged = new Map();

    this.normalizeFocusLossEvents(existingEvents).forEach((event) => {
      merged.set(event.id, event);
    });
    this.normalizeFocusLossEvents(incomingEvents).forEach((event) => {
      merged.set(event.id, event);
    });

    return [...merged.values()].sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  }

  buildDeterministicFocusLossAssessment({ events = [], currentResult = null }) {
    const normalizedEvents = this.normalizeFocusLossEvents(events);
    const distinctEventTypes = [
      ...new Set(normalizedEvents.map((event) => event.type)),
    ];
    const formattedTypes = distinctEventTypes
      .map((type) => this.formatFocusEventType(type))
      .filter(Boolean);
    const hasFocusLoss = normalizedEvents.length > 0;

    return {
      hasFocusLoss,
      automaticFailure: hasFocusLoss,
      eventCount: normalizedEvents.length,
      distinctEventTypes,
      classification: hasFocusLoss ? "integrity-failure" : "clear",
      riskLevel: hasFocusLoss ? "critical" : "none",
      summary: hasFocusLoss
        ? `Focus-loss events were detected during the interview (${formattedTypes.join(", ")}). Under the current interview integrity policy, the session is automatically failed.`
        : "No focus-loss events were recorded for this interview session.",
      recommendation: hasFocusLoss
        ? "Fail the session immediately and require a fresh interview attempt."
        : "No integrity action is required.",
      concerns: hasFocusLoss
        ? [
            `Detected ${normalizedEvents.length} focus-loss event(s) across ${formattedTypes.join(", ")} behavior.`,
            "The current interview integrity policy requires automatic failure when browser focus is lost.",
          ]
        : [],
      previousStatus: currentResult?.status || "",
      previousScore: Number.isFinite(Number(currentResult?.score))
        ? Number(currentResult.score)
        : null,
      reviewedAt: new Date(),
    };
  }

  sanitizeFocusLossAssessmentPayload(payload, fallback) {
    const concernList = Array.isArray(payload?.concerns)
      ? payload.concerns
          .map((item) => this.normalizeText(item, 180))
          .filter(Boolean)
          .slice(0, 4)
      : fallback.concerns;

    return {
      hasFocusLoss: Boolean(fallback.hasFocusLoss),
      automaticFailure: Boolean(fallback.automaticFailure),
      eventCount: fallback.eventCount || 0,
      distinctEventTypes: fallback.distinctEventTypes || [],
      classification:
        this.normalizeText(payload?.classification, 80) ||
        fallback.classification,
      riskLevel:
        this.normalizeText(payload?.riskLevel, 40) || fallback.riskLevel,
      summary: this.normalizeText(payload?.summary, 400) || fallback.summary,
      recommendation:
        this.normalizeText(payload?.recommendation, 200) ||
        fallback.recommendation,
      concerns: concernList.length > 0 ? concernList : fallback.concerns,
      previousStatus: fallback.previousStatus || "",
      previousScore: fallback.previousScore,
      reviewedAt: new Date(),
    };
  }

  buildFocusLossFailureResult({
    currentResult,
    assessment,
    events = [],
  }) {
    const baseResult =
      currentResult && currentResult.toObject
        ? currentResult.toObject()
        : { ...(currentResult || {}) };
    const eventTypes = [
      ...new Set(
        this.normalizeFocusLossEvents(events)
          .map((event) => this.formatFocusEventType(event.type))
          .filter(Boolean),
      ),
    ];
    const policyConcern = `Focus-loss policy triggered automatic failure after ${events.length} event(s): ${eventTypes.join(", ")}.`;
    const existingConcerns = Array.isArray(baseResult.concerns)
      ? baseResult.concerns.filter(
          (item) => !/no major concerns were detected/i.test(String(item || "")),
        )
      : [];
    const concerns = [
      policyConcern,
      ...(assessment?.concerns || []),
      ...existingConcerns,
    ]
      .map((item) => this.normalizeText(item, 180))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 4);

    return {
      ...baseResult,
      score: 0,
      status: AI_INTERVIEW_STATUS.ACTION_REQUIRED,
      badgeLabel: "Failed Integrity Check",
      qualificationLabel: "Integrity Failure",
      percentileLabel: "Session invalidated by focus-loss policy",
      summary:
        assessment?.summary ||
        "Focus-loss events were detected during the interview and the session was automatically failed.",
      strengths: Array.isArray(baseResult.strengths)
        ? baseResult.strengths.slice(0, 2)
        : [],
      concerns,
      nextStepTitle: "Interview Invalidated",
      nextStepDescription:
        this.normalizeText(assessment?.recommendation, 220) ||
        "Focus-loss events were detected during the session. A fresh interview attempt is required.",
      moduleProgress: 100,
      recommendation: "Fail - Integrity Policy",
      confidence: 0.99,
      generatedAt: new Date(),
    };
  }

  buildDeterministicScore({
    question,
    answer,
    candidateContext,
    track,
  }) {
    const answerTokens = this.tokenize(answer);
    const promptKeywords = this.extractKeywords(question.prompt, 14);
    const resumeKeywords = [
      ...(candidateContext?.parsedResume?.keySkills || []),
      ...(candidateContext?.domains || []),
      ...(track?.targetRoles || []),
    ]
      .flatMap((item) => this.tokenize(item))
      .slice(0, 18);

    const promptOverlap =
      promptKeywords.length > 0
        ? this.countIntersection(promptKeywords, answerTokens) /
          promptKeywords.length
        : 0;
    const resumeOverlap =
      resumeKeywords.length > 0
        ? this.countIntersection(resumeKeywords, answerTokens) /
          resumeKeywords.length
        : 0;

    const wordCount = answerTokens.length;
    const sentenceCount = String(answer)
      .split(/[.!?]/)
      .map((item) => item.trim())
      .filter(Boolean).length;
    const reasoningMarkers = this.countReasoningMarkers(answer);

    let clarity = Math.round(
      5 + Math.min(wordCount / 55, 2) + Math.min(sentenceCount / 4, 1.5),
    );
    let instructionFidelity = Math.round(
      4.5 +
        promptOverlap * 4.5 +
        (/\b(example|instruction|guideline|quality|escalat)/i.test(answer)
          ? 1
          : 0),
    );
    let reasoning = Math.round(
      4.5 + Math.min(reasoningMarkers, 3) + Math.min(wordCount / 80, 1.5),
    );
    let domainFit = Math.round(
      4.5 + resumeOverlap * 4.5 + (track.type === "project" ? 0.5 : 0),
    );

    if (wordCount < 45) {
      clarity -= 1;
      reasoning -= 1;
    }

    clarity = this.clamp(clarity, 0, 10, 0);
    instructionFidelity = this.clamp(instructionFidelity, 0, 10, 0);
    reasoning = this.clamp(reasoning, 0, 10, 0);
    domainFit = this.clamp(domainFit, 0, 10, 0);

    const overallScore = this.clamp(
      Math.round(
        (clarity * 0.22 +
          instructionFidelity * 0.23 +
          reasoning * 0.3 +
          domainFit * 0.25) *
          10,
      ),
      0,
      100,
      0,
    );

    const flags = [];
    if (wordCount < 45) {
      flags.push("brief_response");
    }
    if (promptOverlap < 0.15) {
      flags.push("generic_response");
    }
    if (track.type === "project" && domainFit < 5) {
      flags.push("weak_domain_fit");
    }

    return {
      scores: {
        clarity,
        instructionFidelity,
        reasoning,
        domainFit,
      },
      overallScore,
      flags,
      notes:
        overallScore >= 80
          ? "Clear, grounded answer with useful reasoning and workflow discipline."
          : overallScore >= 65
            ? "Solid baseline answer, but depth and precision can be stronger."
            : "Answer needs stronger specificity, clearer structure, and tighter task reasoning.",
      metadata: {
        agent: AI_AGENTS.SCORER,
        provider: DETERMINISTIC_PROVIDER,
        model: "heuristic-scorer",
        promptVersion: this.llmProvider.getPromptVersion(),
        latencyMs: 0,
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
      },
    };
  }

  sanitizeScorePayload(payload, fallback) {
    const scores = payload?.scores || {};

    return {
      clarity: this.clamp(scores.clarity, 0, 10, fallback.scores.clarity),
      instructionFidelity: this.clamp(
        scores.instructionFidelity,
        0,
        10,
        fallback.scores.instructionFidelity,
      ),
      reasoning: this.clamp(
        scores.reasoning,
        0,
        10,
        fallback.scores.reasoning,
      ),
      domainFit: this.clamp(
        scores.domainFit,
        0,
        10,
        fallback.scores.domainFit,
      ),
      overallScore: this.clamp(
        payload?.overallScore,
        0,
        100,
        fallback.overallScore,
      ),
      flags: Array.isArray(payload?.flags)
        ? [...new Set(payload.flags.map((item) => String(item).trim()).filter(Boolean))]
        : fallback.flags,
      notes:
        this.normalizeText(payload?.notes, 300) || fallback.notes,
    };
  }

  buildDeterministicQuestion(baseQuestion, candidateContext) {
    const personalizationHint =
      candidateContext?.parsedResume?.keySkills?.[0] ||
      candidateContext?.domains?.[0] ||
      "";

    return {
      prompt: personalizationHint
        ? `${baseQuestion.basePrompt || baseQuestion.prompt} Where relevant, relate your answer to ${personalizationHint}.`
        : baseQuestion.basePrompt || baseQuestion.prompt,
      placeholder: baseQuestion.placeholder || "",
      tip: baseQuestion.tip || "",
      metadata: {
        provider: DETERMINISTIC_PROVIDER,
      },
    };
  }

  sanitizeQuestionPayload(payload, fallbackQuestion) {
    const prompt =
      this.normalizeText(payload?.prompt, 500) ||
      fallbackQuestion.prompt ||
      fallbackQuestion.basePrompt;

    return {
      id: fallbackQuestion.id,
      sectionTitle: fallbackQuestion.sectionTitle,
      prompt,
      placeholder:
        this.normalizeText(payload?.placeholder, 220) ||
        fallbackQuestion.placeholder ||
        "",
      tip:
        this.normalizeText(payload?.tip, 220) ||
        fallbackQuestion.tip ||
        "",
      suggestedMinutes: fallbackQuestion.suggestedMinutes || 0,
      basePrompt: fallbackQuestion.basePrompt || fallbackQuestion.prompt,
      generatedByAi:
        prompt !== (fallbackQuestion.basePrompt || fallbackQuestion.prompt),
      metadata: payload?.metadata || {},
    };
  }

  buildDeterministicReport({ score, dimensionScores, track }) {
    const status = this.determineDecision(score, dimensionScores);
    const sortedDimensions = [...dimensionScores].sort(
      (left, right) => right.score - left.score,
    );

    const strengths = sortedDimensions.slice(0, 2).map((dimension) => ({
      title: `${dimension.label} strength`,
      description: dimension.note,
    }));

    const concerns = sortedDimensions
      .filter((dimension) => dimension.score < 6)
      .slice(0, 3)
      .map(
        (dimension) =>
          `${dimension.label} needs stronger evidence, specificity, or consistency.`,
      );

    const nextStep = this.buildNextStep(status);

    return {
      score,
      status,
      badgeLabel: this.formatDecisionLabel(status),
      qualificationLabel: this.buildQualificationLabel(score),
      percentileLabel: this.buildPercentileLabel(score),
      summary:
        status === AI_INTERVIEW_STATUS.PASSED
          ? `You showed a dependable baseline for ${track.title.toLowerCase()} with clear operational judgment.`
          : status === AI_INTERVIEW_STATUS.RETRY_REQUIRED
            ? `You showed useful potential, but a few quality signals need a stronger and more consistent answer.`
            : `Your current interview signals are below the expected baseline for ${track.title.toLowerCase()}.`,
      strengths,
      concerns:
        concerns.length > 0
          ? concerns
          : ["No major concerns were detected in the current interview."],
      nextStepTitle: nextStep.nextStepTitle,
      nextStepDescription: nextStep.nextStepDescription,
      moduleProgress: 100,
      recommendation: this.buildRecommendation(status, score),
      confidence: Number(Math.min(0.95, Math.max(0.55, score / 100)).toFixed(2)),
    };
  }

  sanitizeReportPayload(payload, fallback) {
    const score = this.clamp(payload?.score, 0, 100, fallback.score);
    const status = FINAL_DECISIONS.includes(payload?.status)
      ? payload.status
      : fallback.status;

    const strengthList = Array.isArray(payload?.strengths)
      ? payload.strengths
          .map((item) => ({
            title: this.normalizeText(item?.title, 80),
            description: this.normalizeText(item?.description, 220),
          }))
          .filter((item) => item.title)
          .slice(0, 3)
      : fallback.strengths;

    const concernList = Array.isArray(payload?.concerns)
      ? payload.concerns
          .map((item) => this.normalizeText(item, 180))
          .filter(Boolean)
          .slice(0, 4)
      : fallback.concerns;

    const nextStep = this.buildNextStep(status);

    return {
      score,
      status,
      badgeLabel: this.formatDecisionLabel(status),
      qualificationLabel: this.buildQualificationLabel(score),
      percentileLabel: this.buildPercentileLabel(score),
      summary:
        this.normalizeText(payload?.summary, 600) || fallback.summary,
      strengths: strengthList.length > 0 ? strengthList : fallback.strengths,
      concerns: concernList.length > 0 ? concernList : fallback.concerns,
      nextStepTitle:
        this.normalizeText(payload?.nextStepTitle, 80) ||
        fallback.nextStepTitle ||
        nextStep.nextStepTitle,
      nextStepDescription:
        this.normalizeText(payload?.nextStepDescription, 220) ||
        fallback.nextStepDescription ||
        nextStep.nextStepDescription,
      moduleProgress: 100,
      recommendation:
        this.normalizeText(payload?.recommendation, 80) ||
        fallback.recommendation,
      confidence: Number(
        this.clamp(payload?.confidence, 0, 1, fallback.confidence).toFixed(2),
      ),
      generatedAt: new Date(),
    };
  }

  async assessFocusLoss({
    session,
    user,
    track,
    events,
    currentResult,
  }) {
    const normalizedEvents = this.normalizeFocusLossEvents(events);
    const deterministic = this.buildDeterministicFocusLossAssessment({
      events: normalizedEvents,
      currentResult,
    });

    if (!normalizedEvents.length) {
      return deterministic;
    }

    try {
      const response = await this.llmProvider.assessFocusLoss({
        messages: buildFocusLossPrompt({
          promptVersion: this.llmProvider.getPromptVersion(),
          candidateContext: this.buildCandidateContext(
            user,
            session.parsedResume || {},
          ),
          track,
          currentResult,
          events: normalizedEvents,
        }),
      });

      this.recordAiMetadata(session, response.metadata);
      return this.sanitizeFocusLossAssessmentPayload(
        response.data,
        deterministic,
      );
    } catch (error) {
      this.recordAiMetadata(
        session,
        {
          agent: AI_AGENTS.FOCUS_REVIEWER,
          provider: DETERMINISTIC_PROVIDER,
          model: "heuristic-focus-reviewer",
          promptVersion: this.llmProvider.getPromptVersion(),
          latencyMs: 0,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
        },
        "fallback",
        error.message,
      );

      return this.sanitizeFocusLossAssessmentPayload(
        deterministic,
        deterministic,
      );
    }
  }

  async resolveCurrentResult({ session, track, user }) {
    if (session.result) {
      return session.result;
    }

    const aggregateScore = this.computeAggregateScore(session.answers || []);
    const dimensionScores =
      Array.isArray(session.dimensionScores) && session.dimensionScores.length > 0
        ? session.dimensionScores
        : this.aggregateDimensionScores(session.answers || []);
    const fallbackTrack = track || {
      id: session.trackId,
      title: session.trackTitle || "AI Interview",
      type: session.type,
      targetRoles: [],
    };

    const hasCompletedAnswers =
      (session.totalQuestions || 0) > 0 &&
      (session.answers || []).length >= session.totalQuestions;

    if (!hasCompletedAnswers) {
      return this.buildDeterministicReport({
        score: aggregateScore,
        dimensionScores,
        track: fallbackTrack,
      });
    }

    return this.generateFinalReport({
      session,
      track: fallbackTrack,
      user,
    });
  }

  async applyFocusLossPolicy({
    session,
    user,
    track,
    currentResult = null,
  }) {
    const normalizedEvents = this.normalizeFocusLossEvents(
      session.focusLossEvents || [],
    );

    session.focusLossEvents = normalizedEvents;
    session.focusLossAssessment = await this.assessFocusLoss({
      session,
      user,
      track,
      events: normalizedEvents,
      currentResult,
    });

    if (!normalizedEvents.length) {
      return currentResult;
    }

    return this.buildFocusLossFailureResult({
      currentResult,
      assessment: session.focusLossAssessment,
      events: normalizedEvents,
    });
  }

  recordAiMetadata(session, metadata, status = "success", errorMessage = "") {
    if (!metadata) {
      return;
    }

    if (!session.providerMetadata) {
      session.providerMetadata = {};
    }

    session.providerMetadata.provider =
      metadata.provider || session.providerMetadata.provider || "";
    session.providerMetadata.mainModel =
      session.providerMetadata.mainModel || this.llmProvider.mainModel || "";
    session.providerMetadata.scoreModel =
      session.providerMetadata.scoreModel || this.llmProvider.scoreModel || "";
    session.providerMetadata.promptVersion =
      metadata.promptVersion ||
      session.providerMetadata.promptVersion ||
      this.llmProvider.getPromptVersion();
    session.providerMetadata.totalTokensUsed =
      (session.providerMetadata.totalTokensUsed || 0) +
      (metadata.tokensUsed || 0);

    if (!Array.isArray(session.providerMetadata.aiCallLog)) {
      session.providerMetadata.aiCallLog = [];
    }

    session.providerMetadata.aiCallLog.push({
      agent: metadata.agent || "",
      provider: metadata.provider || "",
      model: metadata.model || "",
      promptVersion: metadata.promptVersion || "",
      latencyMs: metadata.latencyMs || 0,
      tokensUsed: metadata.tokensUsed || 0,
      promptTokens: metadata.promptTokens || 0,
      completionTokens: metadata.completionTokens || 0,
      status,
      errorMessage,
      createdAt: new Date(),
    });
  }

  async personalizeQuestion({
    session,
    user,
    track,
    questionIndex,
  }) {
    const questionDocument = session.questions[questionIndex];
    if (!questionDocument) {
      return null;
    }

    const baseQuestion = questionDocument.toObject
      ? questionDocument.toObject()
      : { ...questionDocument };

    const candidateContext = this.buildCandidateContext(
      user,
      session.parsedResume || {},
    );
    const deterministic = this.buildDeterministicQuestion(
      baseQuestion,
      candidateContext,
    );

    try {
      const response = await this.llmProvider.generateInterviewQuestion({
        messages: buildInterviewerPrompt({
          promptVersion: this.llmProvider.getPromptVersion(),
          candidateContext,
          track,
          baseQuestion: {
            ...baseQuestion,
            prompt: baseQuestion.basePrompt || baseQuestion.prompt,
          },
          currentQuestionIndex: questionIndex,
          previousAnswers: session.answers || [],
        }),
      });

      this.recordAiMetadata(session, response.metadata);
      return this.sanitizeQuestionPayload(response.data, {
        ...baseQuestion,
        ...deterministic,
      });
    } catch (error) {
      this.recordAiMetadata(
        session,
        deterministic.metadata
          ? {
              ...deterministic.metadata,
              agent: AI_AGENTS.INTERVIEWER,
            }
          : {
              agent: AI_AGENTS.INTERVIEWER,
              provider: DETERMINISTIC_PROVIDER,
              model: "heuristic-interviewer",
              promptVersion: this.llmProvider.getPromptVersion(),
            },
        "fallback",
        error.message,
      );

      return this.sanitizeQuestionPayload(deterministic, baseQuestion);
    }
  }

  async scoreAnswer({
    session,
    user,
    track,
    question,
    answer,
  }) {
    const candidateContext = this.buildCandidateContext(
      user,
      session.parsedResume || {},
    );
    const deterministic = this.buildDeterministicScore({
      question,
      answer,
      candidateContext,
      track,
    });

    try {
      const response = await this.llmProvider.scoreAnswer({
        messages: buildScoringPrompt({
          promptVersion: this.llmProvider.getPromptVersion(),
          candidateContext,
          track,
          question,
          answer,
          previousAnswers: session.answers || [],
        }),
      });

      this.recordAiMetadata(session, response.metadata);
      return this.sanitizeScorePayload(response.data, deterministic);
    } catch (error) {
      this.recordAiMetadata(
        session,
        deterministic.metadata,
        "fallback",
        error.message,
      );

      return this.sanitizeScorePayload(deterministic, deterministic);
    }
  }

  async generateFinalReport({ session, track, user }) {
    const score = this.computeAggregateScore(session.answers || []);
    const dimensionScores = this.aggregateDimensionScores(session.answers || []);
    const candidateContext = this.buildCandidateContext(
      user,
      session.parsedResume || {},
    );
    const deterministic = this.buildDeterministicReport({
      score,
      dimensionScores,
      track,
    });

    try {
      const response = await this.llmProvider.generateReport({
        messages: buildReportPrompt({
          promptVersion: this.llmProvider.getPromptVersion(),
          candidateContext,
          track,
          answers: session.answers || [],
          dimensionScores,
          aggregateScore: score,
        }),
      });

      this.recordAiMetadata(session, response.metadata);
      return this.sanitizeReportPayload(response.data, deterministic);
    } catch (error) {
      this.recordAiMetadata(
        session,
        {
          agent: AI_AGENTS.REPORTER,
          provider: DETERMINISTIC_PROVIDER,
          model: "heuristic-reporter",
          promptVersion: this.llmProvider.getPromptVersion(),
          latencyMs: 0,
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
        },
        "fallback",
        error.message,
      );

      return this.sanitizeReportPayload(deterministic, deterministic);
    }
  }

  async ensureSessionQuestionPersonalized(session, user, track, questionIndex) {
    const updatedQuestion = await this.personalizeQuestion({
      session,
      user,
      track,
      questionIndex,
    });

    if (updatedQuestion) {
      session.questions[questionIndex] = updatedQuestion;
      session.trackSnapshot = this.buildTrackSnapshot(track, session.questions);
      session.markModified("questions");
      session.markModified("trackSnapshot");
    }
  }

  async listProjectTracks() {
    const projects = await AnnotationProject.find({
      isActive: true,
      isPublic: true,
      status: "active",
      openCloseStatus: "open",
      aiInterviewRequired: true,
    })
      .select(
        [
          "projectName",
          "projectDescription",
          "projectCategory",
          "difficultyLevel",
          "requiredSkills",
          "minimumExperience",
          "languageRequirements",
          "tags",
          "payRate",
          "payRateCurrency",
          "payRateType",
          "estimatedDuration",
          "projectGuidelineLink",
          "projectGuidelineVideo",
          "projectCommunityLink",
          "projectTrackerLink",
          "projectFiles",
        ].join(" "),
      )
      .sort({ createdAt: -1 })
      .lean();

    return projects.map((project) => buildProjectTrackFromProject(project));
  }

  async resolveTrack(trackId, user, options = {}) {
    if (!isProjectTrackId(trackId)) {
      return getAiInterviewTrackById(trackId, user);
    }

    const projectId = extractProjectIdFromTrackId(trackId);
    if (!projectId) {
      return null;
    }

    const project = options.project || (await this.findProjectById(projectId));
    if (
      !project ||
      project.isActive === false ||
      project.status !== "active" ||
      project.isPublic === false ||
      project.aiInterviewRequired !== true
    ) {
      return null;
    }

    const parsedResume = options.parsedResume || {};
    const projectTrack = await this.buildProjectTrack({
      project,
      user,
      parsedResume,
      useAi: Boolean(options.useAi),
    });

    return projectTrack.track;
  }

  async resolveResumeContext(user, body = {}) {
    return this.resumeService.resolveResumeContextForUser({
      user,
      resumeAssetId: body.resumeAssetId,
      resumeName: body.resumeName,
    });
  }

  async ensureInterviewResourceSeeded() {
    if (this.rbacEnsured) {
      return;
    }

    const existing = await Resource.findOne({ link: "/interviews" });
    if (!existing) {
      const count = await Resource.countDocuments({});
      await Resource.create({
        title: "AI Interview",
        link: "/interviews",
        description: "AI interview module",
        sortOrder: count + 1,
        isPublished: true,
      });
    }

    this.rbacEnsured = true;
  }

  async notifyProjectAdminsOfPendingApplication({
    project,
    application,
    applicant,
  }) {
    const projectWithAdmins = await AnnotationProject.findById(project._id)
      .populate("createdBy", "fullName email")
      .populate("assignedAdmins", "fullName email");
    if (!projectWithAdmins) {
      return false;
    }

    const adminRecipients = [];
    if (projectWithAdmins.createdBy?.email) {
      adminRecipients.push({
        email: projectWithAdmins.createdBy.email,
        fullName: projectWithAdmins.createdBy.fullName || "Project Admin",
      });
    }

    for (const admin of projectWithAdmins.assignedAdmins || []) {
      if (
        admin?.email &&
        !adminRecipients.some((item) => item.email === admin.email)
      ) {
        adminRecipients.push({
          email: admin.email,
          fullName: admin.fullName || "Project Admin",
        });
      }
    }

    const applicationData = {
      applicantName: applicant.fullName,
      applicantEmail: applicant.email,
      resumeUrl: application.resumeUrl || applicant.attachments?.resume_url || "",
      projectName: project.projectName,
      projectCategory: project.projectCategory,
      payRate: project.payRate,
      coverLetter: application.coverLetter || "",
      appliedAt: application.appliedAt || new Date(),
      aiInterviewPassed: true,
      aiInterviewScore: application.aiInterviewScore,
    };

    for (const adminRecipient of adminRecipients) {
      await MailService.sendProjectApplicationNotification(
        adminRecipient.email,
        adminRecipient.fullName,
        applicationData,
      );
    }

    return adminRecipients.length > 0;
  }

  buildProjectApplicationReviewNotes(session, mode = "pass") {
    const score = Number.isFinite(Number(session?.result?.score))
      ? Number(session.result.score)
      : null;
    const status = session?.result?.status || session?.status || "";
    const summary = this.normalizeText(session?.result?.summary, 500);

    if (mode === "pass") {
      return this.normalizeText(
        `AI project interview passed. Final interview status: ${status}. Score: ${score ?? "n/a"}. ${summary}`,
        500,
      );
    }

    return this.normalizeText(
      `Rejected automatically after AI project interview. Final interview status: ${status}. Score: ${score ?? "n/a"}. ${summary}`,
      500,
    );
  }

  async syncProjectApplicationFromInterview(session, user = null) {
    if (
      session?.sessionSource !== "project-application" ||
      !session?.projectId ||
      !session?.projectApplicationId
    ) {
      return null;
    }

    const application = await ProjectApplication.findById(
      session.projectApplicationId,
    );
    if (!application) {
      return null;
    }

    const project = await this.findProjectById(session.projectId);
    if (!project) {
      return null;
    }

    if (project.aiInterviewRequired !== true) {
      return application;
    }

    const applicant = user || (await this.findUserById(session.candidateId));
    if (!applicant) {
      return null;
    }

    application.aiInterviewSessionId = session._id;
    application.aiInterviewTrackId = session.trackId || "";
    application.aiInterviewStatus = session.result?.status || session.status || "";
    application.aiInterviewScore = Number.isFinite(Number(session.result?.score))
      ? Number(session.result.score)
      : null;
    application.aiInterviewSummary =
      this.normalizeText(session.result?.summary, 1000) || "";
    application.aiInterviewCompletedAt = session.completedAt || new Date();

    const finalStatus = session.result?.status || session.status;
    const previousStatus = application.status;
    const isProtectedStatus = ["approved", "removed", "withdrawn"].includes(
      application.status,
    );

    if (!finalStatus || isProtectedStatus) {
      await application.save();
      return application;
    }

    if (finalStatus === AI_INTERVIEW_STATUS.PASSED) {
      application.status = "pending";
      application.reviewedBy = null;
      application.reviewedAt = null;
      application.rejectionReason = null;
      application.reviewNotes = this.buildProjectApplicationReviewNotes(
        session,
        "pass",
      );
      await application.save();

      const shouldNotifyAdmins =
        previousStatus !== "pending" || !application.adminNotified;

      if (shouldNotifyAdmins) {
        try {
          await this.notifyProjectAdminsOfPendingApplication({
            project,
            application,
            applicant,
          });
          application.adminNotified = true;
          await application.save();
        } catch (error) {
          console.error(
            "Failed to notify admins after AI project interview pass:",
            error.message,
          );
        }
      }

      try {
        await createApplicationStatusNotification(
          applicant._id,
          "pending",
          {
            _id: project._id,
            projectName: project.projectName,
            projectCategory: project.projectCategory,
          },
          { _id: application._id },
        );
      } catch (error) {
        console.error(
          "Failed to create pending application notification after AI interview pass:",
          error.message,
        );
      }

      return application;
    }

    application.status = "rejected";
    application.rejectionReason = "ai_interview_failed";
    application.reviewNotes = this.buildProjectApplicationReviewNotes(
      session,
      "fail",
    );
    await application.save();

    const shouldNotifyApplicant =
      previousStatus !== "rejected" || !application.applicantNotified;

    if (shouldNotifyApplicant) {
      try {
        await MailService.sendProjectRejectionNotification(
          applicant.email,
          applicant.fullName,
          {
            projectName: project.projectName,
            projectCategory: project.projectCategory,
            adminName: "AI Interview System",
            rejectionReason: application.rejectionReason,
            reviewNotes: application.reviewNotes,
          },
        );
        application.applicantNotified = true;
        await application.save();
      } catch (error) {
        console.error(
          "Failed to send project rejection notification after AI interview failure:",
          error.message,
        );
      }
    }

    try {
      await createApplicationStatusNotification(
        applicant._id,
        "rejected",
        {
          _id: project._id,
          projectName: project.projectName,
          projectCategory: project.projectCategory,
        },
        { _id: application._id },
      );
    } catch (error) {
      console.error(
        "Failed to create rejection notification after AI interview failure:",
        error.message,
      );
    }

    return application;
  }

  async startProjectApplicationSession({
    userId,
    projectId,
    projectApplicationId,
    body = {},
  }) {
    const [user, project] = await Promise.all([
      this.findUserById(userId),
      this.findProjectById(projectId),
    ]);

    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    if (
      !project ||
      project.isActive === false ||
      project.status !== "active" ||
      project.isPublic === false ||
      project.aiInterviewRequired !== true
    ) {
      return { status: 404, reason: "track_not_found" };
    }

    const application =
      (projectApplicationId &&
        (await ProjectApplication.findOne({
          _id: projectApplicationId,
          projectId: project._id,
          applicantId: user._id,
          status: "ai_interview_required",
        }))) ||
      (await ProjectApplication.findOne({
        projectId: project._id,
        applicantId: user._id,
        status: "ai_interview_required",
      }));

    if (!application) {
      return { status: 404, reason: "project_application_not_found" };
    }

    const resumeContext = await this.resolveResumeContext(user, body);
    if (resumeContext.status && resumeContext.status !== 200) {
      return resumeContext;
    }

    let session = await this.sessionRepository.findLatestProjectApplicationSession(
      user._id,
      project._id,
    );
    const projectTrackResult = await this.buildProjectTrack({
      project,
      user,
      parsedResume: resumeContext.parsedProfile || {},
      useAi: true,
    });
    const track = projectTrackResult.track;

    if (!session) {
      session = await this.sessionRepository.create({
        candidateId: user._id,
        candidateName: user.fullName,
        candidateEmail: user.email,
        sessionSource: "project-application",
        projectId: project._id,
        projectName: project.projectName,
        projectApplicationId: application._id,
        trackId: buildProjectTrackId(project._id),
        trackTitle: track.title,
        type: track.type,
        languageCode: body.languageCode || "en-US",
        status: AI_INTERVIEW_STATUS.IN_PROGRESS,
        aiName: DEFAULT_AI_NAME,
        targetRole: track.targetRoles?.[0] || `${project.projectCategory} Annotator`,
        specialization: this.deriveSpecialization(
          track,
          resumeContext.parsedProfile,
          user,
        ),
        resumeAssetId: resumeContext.asset?._id || null,
        resumeName:
          resumeContext.resumeName ||
          body.resumeName ||
          application.resumeUrl?.split("/").pop() ||
          "",
        resumeUrl: resumeContext.resumeUrl || application.resumeUrl || "",
        parsedResume: resumeContext.parsedProfile || {},
        trackSnapshot: this.buildTrackSnapshot(track, this.buildTrackQuestions(track)),
        questions: this.buildTrackQuestions(track),
        currentQuestionIndex: 0,
        durationMinutes: track.durationMinutes || 0,
        startedAt: new Date(),
        applicationContext: {
          coverLetter: application.coverLetter || body.coverLetter || "",
          proposedRate:
            application.proposedRate ??
            body.proposedRate ??
            project.payRate ??
            null,
          availability: application.availability || body.availability || "flexible",
          estimatedCompletionTime:
            application.estimatedCompletionTime ||
            body.estimatedCompletionTime ||
            "",
          submittedAt: application.appliedAt || new Date(),
        },
        providerMetadata: {
          provider: "",
          mainModel: this.llmProvider.mainModel || "",
          scoreModel: this.llmProvider.scoreModel || "",
          promptVersion: this.llmProvider.getPromptVersion(),
          totalTokensUsed: 0,
          aiCallLog: [],
        },
      });
    } else {
      session.candidateName = user.fullName;
      session.candidateEmail = user.email;
      session.sessionSource = "project-application";
      session.projectId = project._id;
      session.projectName = project.projectName;
      session.projectApplicationId = application._id;
      session.trackId = buildProjectTrackId(project._id);
      session.trackTitle = track.title;
      session.type = track.type;
      session.languageCode = body.languageCode || session.languageCode || "en-US";
      session.targetRole =
        session.targetRole || track.targetRoles?.[0] || `${project.projectCategory} Annotator`;
      session.specialization =
        session.specialization ||
        this.deriveSpecialization(track, resumeContext.parsedProfile, user);
      session.resumeAssetId = resumeContext.asset?._id || session.resumeAssetId;
      session.resumeName =
        resumeContext.resumeName || body.resumeName || session.resumeName;
      session.resumeUrl = resumeContext.resumeUrl || session.resumeUrl;
      session.parsedResume =
        resumeContext.parsedProfile || session.parsedResume || {};
      session.durationMinutes = track.durationMinutes || session.durationMinutes;
      session.aiName = session.aiName || DEFAULT_AI_NAME;
      session.applicationContext = {
        coverLetter: application.coverLetter || body.coverLetter || "",
        proposedRate:
          application.proposedRate ??
          body.proposedRate ??
          project.payRate ??
          null,
        availability: application.availability || body.availability || "flexible",
        estimatedCompletionTime:
          application.estimatedCompletionTime ||
          body.estimatedCompletionTime ||
          "",
        submittedAt: application.appliedAt || session.applicationContext?.submittedAt || new Date(),
      };

      if (!Array.isArray(session.questions) || session.questions.length === 0) {
        session.questions = this.buildTrackQuestions(track);
      }

      if (
        session.status === AI_INTERVIEW_STATUS.SCHEDULED ||
        session.status === AI_INTERVIEW_STATUS.NOT_STARTED
      ) {
        session.status = AI_INTERVIEW_STATUS.IN_PROGRESS;
      }

      if (!session.startedAt) {
        session.startedAt = new Date();
      }
    }

    session.trackSnapshot = this.buildTrackSnapshot(track, session.questions);
    this.recordAiMetadata(
      session,
      projectTrackResult.metadata,
      projectTrackResult.status === "fallback" ? "fallback" : "success",
      projectTrackResult.errorMessage || "",
    );

    const currentQuestion = session.questions[session.currentQuestionIndex || 0];
    if (currentQuestion && !currentQuestion.generatedByAi) {
      await this.ensureSessionQuestionPersonalized(
        session,
        user,
        track,
        session.currentQuestionIndex || 0,
      );
    }

    await this.sessionRepository.save(session);

    application.aiInterviewSessionId = session._id;
    application.aiInterviewTrackId = session.trackId;
    application.aiInterviewStatus = session.status;
    application.aiInterviewScore = Number.isFinite(Number(session.result?.score))
      ? Number(session.result.score)
      : null;
    application.aiInterviewSummary =
      this.normalizeText(session.result?.summary, 1000) || "";
    await application.save();

    return {
      status: 200,
      payload: {
        session: this.serializeSession(session),
        application,
      },
    };
  }

  async getCandidateOverview({ userId }) {
    const user = await this.findUserById(userId);
    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    const [sessions, tracks] = await Promise.all([
      this.sessionRepository.findAllByCandidate(user._id),
      Promise.resolve(getAiInterviewTracks(user)),
    ]);

    const stats = {
      completed: sessions.filter((item) => FINAL_DECISIONS.includes(item.status))
        .length,
      pending: sessions.filter((item) => ACTIVE_SESSION_STATUSES.includes(item.status))
        .length,
      passed: sessions.filter((item) => item.status === AI_INTERVIEW_STATUS.PASSED)
        .length,
      actionRequired: sessions.filter((item) => ACTIONABLE_STATUSES.includes(item.status))
        .length,
    };

    const trackCards = tracks.map((track) => {
      const latestSession = sessions.find((item) => item.trackId === track.id);
      return {
        ...this.serializeTrack(track),
        status: latestSession?.status || AI_INTERVIEW_STATUS.NOT_STARTED,
        latestSessionId: latestSession ? String(latestSession._id) : null,
        lastAttemptedAt:
          latestSession?.completedAt ||
          latestSession?.startedAt ||
          latestSession?.updatedAt ||
          null,
        score: latestSession?.result?.score ?? null,
      };
    });

    const recentActivity = sessions
      .filter((item) => FINAL_DECISIONS.includes(item.status))
      .slice(0, 5)
      .map((item) => ({
        id: String(item._id),
        title: item.trackTitle,
        type: item.type,
        attemptedAt: item.completedAt || item.updatedAt,
        status: item.status,
        score: item.result?.score ?? null,
      }));

    return {
      status: 200,
      payload: {
        stats,
        tracks: trackCards,
        recentActivity,
      },
    };
  }

  async listTracks({ userId }) {
    const user = await this.findUserById(userId);
    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    const sessions = await this.sessionRepository.findAllByCandidate(user._id);
    const tracks = getAiInterviewTracks(user).map((track) => {
      const latestSession = sessions.find((item) => item.trackId === track.id);
      return {
        ...this.serializeTrack(track),
        status: latestSession?.status || AI_INTERVIEW_STATUS.NOT_STARTED,
        latestSessionId: latestSession ? String(latestSession._id) : null,
        score: latestSession?.result?.score ?? null,
      };
    });

    return {
      status: 200,
      payload: tracks,
    };
  }

  async getTrack({ userId, trackId }) {
    const user = await this.findUserById(userId);
    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    const track = await this.resolveTrack(trackId, user, {
      useAi: isProjectTrackId(trackId),
    });
    if (!track) {
      return { status: 404, reason: "track_not_found" };
    }

    return {
      status: 200,
      payload: this.serializeTrack(track),
    };
  }

  async startSession({ userId, body }) {
    const user = await this.findUserById(userId);
    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    if (isProjectTrackId(body.trackId)) {
      const projectId = extractProjectIdFromTrackId(body.trackId);
      return this.startProjectApplicationSession({
        userId: user._id,
        projectId,
        projectApplicationId: body.projectApplicationId,
        body,
      });
    }

    const track = await this.resolveTrack(body.trackId, user);
    if (!track) {
      return { status: 404, reason: "track_not_found" };
    }

    const resumeContext = await this.resolveResumeContext(user, body);
    if (resumeContext.status && resumeContext.status !== 200) {
      return resumeContext;
    }

    let session = await this.sessionRepository.findLatestUnfinished(
      user._id,
      track.id,
    );

    if (!session) {
      session = await this.sessionRepository.create({
        candidateId: user._id,
        candidateName: user.fullName,
        candidateEmail: user.email,
        trackId: track.id,
        trackTitle: track.title,
        type: track.type,
        languageCode: body.languageCode || "en-US",
        status: AI_INTERVIEW_STATUS.IN_PROGRESS,
        aiName: DEFAULT_AI_NAME,
        targetRole: body.targetRole || track.targetRoles?.[0] || "",
        specialization: this.deriveSpecialization(
          track,
          resumeContext.parsedProfile,
          user,
        ),
        resumeAssetId: resumeContext.asset?._id || null,
        resumeName:
          resumeContext.resumeName ||
          body.resumeName ||
          track.title.toLowerCase().replace(/\s+/g, "-"),
        resumeUrl: resumeContext.resumeUrl || "",
        parsedResume: resumeContext.parsedProfile || {},
        trackSnapshot: this.buildTrackSnapshot(track, this.buildTrackQuestions(track)),
        questions: this.buildTrackQuestions(track),
        currentQuestionIndex: 0,
        durationMinutes: track.durationMinutes || 0,
        startedAt: new Date(),
        providerMetadata: {
          provider: "",
          mainModel: this.llmProvider.mainModel || "",
          scoreModel: this.llmProvider.scoreModel || "",
          promptVersion: this.llmProvider.getPromptVersion(),
          totalTokensUsed: 0,
          aiCallLog: [],
        },
      });
    } else {
      session.candidateName = user.fullName;
      session.candidateEmail = user.email;
      session.languageCode = body.languageCode || session.languageCode || "en-US";
      session.targetRole =
        body.targetRole || session.targetRole || track.targetRoles?.[0] || "";
      session.specialization =
        session.specialization ||
        this.deriveSpecialization(track, resumeContext.parsedProfile, user);
      session.resumeAssetId = resumeContext.asset?._id || session.resumeAssetId;
      session.resumeName =
        resumeContext.resumeName || body.resumeName || session.resumeName;
      session.resumeUrl = resumeContext.resumeUrl || session.resumeUrl;
      session.parsedResume =
        resumeContext.parsedProfile || session.parsedResume || {};
      session.trackTitle = track.title;
      session.type = track.type;
      session.durationMinutes = track.durationMinutes || session.durationMinutes;
      session.aiName = session.aiName || DEFAULT_AI_NAME;

      if (!Array.isArray(session.questions) || session.questions.length === 0) {
        session.questions = this.buildTrackQuestions(track);
      }

      if (
        session.status === AI_INTERVIEW_STATUS.SCHEDULED ||
        session.status === AI_INTERVIEW_STATUS.NOT_STARTED
      ) {
        session.status = AI_INTERVIEW_STATUS.IN_PROGRESS;
      }

      if (!session.startedAt) {
        session.startedAt = new Date();
      }
    }

    session.trackSnapshot = this.buildTrackSnapshot(track, session.questions);

    const currentQuestion =
      session.questions[session.currentQuestionIndex || 0];
    if (currentQuestion && !currentQuestion.generatedByAi) {
      await this.ensureSessionQuestionPersonalized(
        session,
        user,
        track,
        session.currentQuestionIndex || 0,
      );
    }

    await this.sessionRepository.save(session);

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async getSessionForCandidate({ userId, sessionId }) {
    const session = await this.sessionRepository.findOne({
      _id: sessionId,
      candidateId: userId,
    });

    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async saveDraft({ userId, sessionId, draftAnswer }) {
    const session = await this.sessionRepository.findOne({
      _id: sessionId,
      candidateId: userId,
    });

    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    if (FINAL_DECISIONS.includes(session.status)) {
      return { status: 409, reason: "session_completed" };
    }

    session.draftAnswer = this.normalizeText(draftAnswer, 5000);
    await this.sessionRepository.save(session);

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async submitAnswer({ userId, sessionId, answer }) {
    const [user, session] = await Promise.all([
      this.findUserById(userId),
      this.sessionRepository.findOne({ _id: sessionId, candidateId: userId }),
    ]);

    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    if (FINAL_DECISIONS.includes(session.status)) {
      return { status: 409, reason: "session_completed" };
    }

    if (
      session.status === AI_INTERVIEW_STATUS.SCHEDULED ||
      session.status === AI_INTERVIEW_STATUS.NOT_STARTED
    ) {
      session.status = AI_INTERVIEW_STATUS.IN_PROGRESS;
      session.startedAt = session.startedAt || new Date();
    }

    const questionIndex = Number(session.currentQuestionIndex) || 0;
    const question = session.questions[questionIndex];
    if (!question) {
      return { status: 400, reason: "question_not_found" };
    }

    const track =
      session.trackSnapshot && session.trackSnapshot.id
        ? session.trackSnapshot
        : await this.resolveTrack(session.trackId, user);

    const score = await this.scoreAnswer({
      session,
      user,
      track,
      question,
      answer,
    });

    session.answers.push({
      questionId: question.id,
      questionPrompt: question.prompt,
      sectionTitle: question.sectionTitle,
      answer: this.normalizeText(answer, 6000),
      submittedAt: new Date(),
      score,
    });

    session.draftAnswer = "";
    session.dimensionScores = this.aggregateDimensionScores(session.answers);

    const isFinalQuestion = questionIndex >= session.totalQuestions - 1;
    if (isFinalQuestion) {
      let report = await this.generateFinalReport({
        session,
        track,
        user,
      });
      report = await this.applyFocusLossPolicy({
        session,
        user,
        track,
        currentResult: report,
      });

      session.result = report;
      session.status = report.status;
      session.completedAt = new Date();
      session.currentQuestionIndex = Math.max(session.totalQuestions - 1, 0);
    } else {
      const nextQuestionIndex = questionIndex + 1;
      session.currentQuestionIndex = nextQuestionIndex;
      session.status = AI_INTERVIEW_STATUS.IN_PROGRESS;
      await this.ensureSessionQuestionPersonalized(
        session,
        user,
        track,
        nextQuestionIndex,
      );
    }

    session.trackSnapshot = this.buildTrackSnapshot(track, session.questions);
    await this.sessionRepository.save(session);

    if (session.sessionSource === "project-application" && session.result) {
      await this.syncProjectApplicationFromInterview(session, user);
    }

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async submitFocusLossEvents({ userId, sessionId, events }) {
    const [user, session] = await Promise.all([
      this.findUserById(userId),
      this.sessionRepository.findOne({ _id: sessionId, candidateId: userId }),
    ]);

    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    const mergedEvents = this.mergeFocusLossEvents(
      session.focusLossEvents || [],
      events,
    );
    session.focusLossEvents = mergedEvents;

    if (
      (!Array.isArray(session.dimensionScores) || session.dimensionScores.length === 0) &&
      Array.isArray(session.answers) &&
      session.answers.length > 0
    ) {
      session.dimensionScores = this.aggregateDimensionScores(session.answers);
    }

    const track =
      session.trackSnapshot && session.trackSnapshot.id
        ? session.trackSnapshot
        : await this.resolveTrack(session.trackId, user);
    const hasCompletedAnswers =
      (session.totalQuestions || 0) > 0 &&
      (session.answers || []).length >= session.totalQuestions;
    const shouldResolveResult =
      Boolean(session.result) ||
      Boolean(session.completedAt) ||
      hasCompletedAnswers ||
      mergedEvents.length > 0;
    const currentResult = shouldResolveResult
      ? await this.resolveCurrentResult({
          session,
          track,
          user,
        })
      : null;
    const nextResult = await this.applyFocusLossPolicy({
      session,
      user,
      track,
      currentResult,
    });

    if (nextResult) {
      session.result = nextResult;
      session.status = nextResult.status;
    }

    if (mergedEvents.length > 0 || hasCompletedAnswers || nextResult) {
      session.completedAt = session.completedAt || new Date();
    }

    if ((session.totalQuestions || 0) > 0 && mergedEvents.length > 0) {
      session.currentQuestionIndex = Math.max(session.totalQuestions - 1, 0);
    }

    await this.sessionRepository.save(session);

    if (session.sessionSource === "project-application") {
      await this.syncProjectApplicationFromInterview(session, user);
    }

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async getResult({ userId, sessionId }) {
    return this.getSessionForCandidate({ userId, sessionId });
  }

  async uploadResume({ userId, file }) {
    const user = await this.findUserById(userId);
    if (!user) {
      return { status: 404, reason: "user_not_found" };
    }

    const uploadResult = await this.uploadService.uploadResume({
      user: {
        userId: String(user._id),
        email: user.email,
      },
      file,
    });

    if (uploadResult.status !== 200) {
      return uploadResult;
    }

    user.attachments = user.attachments || {};
    user.attachments.resume_url = uploadResult.data.resume_url;

    const resumeContext = await this.resumeService.ensureResumeAsset({
      user,
      fileUrl: uploadResult.data.resume_url,
      fileName: file?.originalname || "",
      source: "ai-upload",
      forceReparse: true,
    });

    return {
      status: 200,
      payload: {
        resumeAssetId: resumeContext.asset ? String(resumeContext.asset._id) : null,
        resumeName:
          resumeContext.resumeName ||
          file?.originalname ||
          uploadResult.data.cloudinaryData?.originalName ||
          "",
        resumeUrl: uploadResult.data.resume_url,
        parsedResume: resumeContext.parsedProfile || null,
        cloudinaryData: uploadResult.data.cloudinaryData || null,
      },
    };
  }

  async getAdminOverview() {
    await this.ensureInterviewResourceSeeded();
    const sessions = await this.sessionRepository.findAdminSessions({});
    const completed = sessions.filter((item) => FINAL_DECISIONS.includes(item.status));
    const passed = completed.filter(
      (item) => item.status === AI_INTERVIEW_STATUS.PASSED,
    );

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const currentWindow = sessions.filter(
      (item) => now - new Date(item.createdAt).getTime() <= sevenDays,
    ).length;
    const previousWindow = sessions.filter((item) => {
      const age = now - new Date(item.createdAt).getTime();
      return age > sevenDays && age <= sevenDays * 2;
    }).length;

    const deltaPercentage = (() => {
      if (previousWindow === 0) {
        return currentWindow > 0 ? "+100%" : "0%";
      }

      const delta = Math.round(
        ((currentWindow - previousWindow) / previousWindow) * 100,
      );
      return `${delta >= 0 ? "+" : ""}${delta}%`;
    })();

    const averageScore = completed.length
      ? Math.round(
          completed.reduce(
            (sum, item) => sum + (item.result?.score || 0),
            0,
          ) / completed.length,
        )
      : 0;

    const passRate = completed.length
      ? Math.round((passed.length / completed.length) * 100)
      : 0;

    const metrics = [
      {
        id: "total",
        label: "Total Interviews",
        value: String(sessions.length),
        delta: deltaPercentage,
        tone: currentWindow >= previousWindow ? "positive" : "negative",
      },
      {
        id: "completed",
        label: "Completed",
        value: String(completed.length),
        delta: `${Math.round(
          (completed.length / Math.max(sessions.length, 1)) * 100,
        )}%`,
        tone: "neutral",
      },
      {
        id: "pass-rate",
        label: "Pass Rate",
        value: `${passRate}%`,
        delta: passed.length > 0 ? "+stable" : "0%",
        tone: passRate >= 50 ? "positive" : "negative",
      },
      {
        id: "avg-score",
        label: "Average Score",
        value: String(averageScore),
        delta: completed.length > 0 ? "+tracked" : "0%",
        tone: averageScore >= 75 ? "positive" : "neutral",
      },
    ];

    const trendMap = new Map();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
      const label = day.toLocaleDateString("en-US", { weekday: "short" });
      trendMap.set(label, 0);
    }

    sessions.forEach((session) => {
      const label = new Date(session.createdAt).toLocaleDateString("en-US", {
        weekday: "short",
      });
      if (trendMap.has(label)) {
        trendMap.set(label, trendMap.get(label) + 1);
      }
    });

    const specializationBuckets = new Map();
    completed.forEach((session) => {
      const key =
        session.specialization ||
        session.targetRole ||
        session.trackTitle ||
        "General Fit";
      const current = specializationBuckets.get(key) || {
        total: 0,
        count: 0,
      };
      current.total += session.result?.score || 0;
      current.count += 1;
      specializationBuckets.set(key, current);
    });

    const topSkillMatch = [...specializationBuckets.entries()]
      .map(([label, value]) => ({
        label,
        value: Math.round(value.total / Math.max(value.count, 1)),
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);

    const recentSubmissions = sessions
      .slice(0, 6)
      .map((session) => this.serializeSession(session));

    return {
      status: 200,
      payload: {
        metrics,
        trend: [...trendMap.entries()].map(([label, interviews]) => ({
          label,
          interviews,
        })),
        topSkillMatch,
        recentSubmissions,
      },
    };
  }

  async getAdminSessions({ query = {} }) {
    const filter = {};

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter.$or = [
        { candidateName: regex },
        { candidateEmail: regex },
        { trackTitle: regex },
        { specialization: regex },
        { targetRole: regex },
      ];
    }

    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) {
        const fromDate = new Date(query.from);
        if (!Number.isNaN(fromDate.getTime())) {
          filter.createdAt.$gte = fromDate;
        }
      }
      if (query.to) {
        const toDate = new Date(query.to);
        if (!Number.isNaN(toDate.getTime())) {
          filter.createdAt.$lte = toDate;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    const sessions = await this.sessionRepository.findAdminSessions(filter);
    return {
      status: 200,
      payload: sessions.map((session) => this.serializeSession(session)),
    };
  }

  async getAdminReport({ sessionId }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    const track =
      session.trackSnapshot && Object.keys(session.trackSnapshot).length > 0
        ? {
            ...session.trackSnapshot,
            questions: this.serializeQuestions(session.questions),
          }
        : this.serializeTrack(
            (await this.resolveTrack(session.trackId, null)) || {
              id: session.trackId,
              title: session.trackTitle,
              type: session.type,
              questions: this.serializeQuestions(session.questions),
            },
          );

    return {
      status: 200,
      payload: {
        session: this.serializeSession(session),
        track,
        adminNote: session.adminNote || "",
      },
    };
  }

  async scheduleInterview({ adminUserId, body }) {
    const [adminUser, candidateUser] = await Promise.all([
      this.findUserById(adminUserId),
      DTUser.findOne({ email: String(body.candidateEmail || "").toLowerCase() }),
    ]);

    if (!adminUser) {
      return { status: 404, reason: "admin_not_found" };
    }

    if (!candidateUser) {
      return { status: 404, reason: "candidate_not_found" };
    }

    const track = await this.resolveTrack(body.trackId, candidateUser);
    if (!track) {
      return { status: 404, reason: "track_not_found" };
    }

    const existing = await this.sessionRepository.findLatestUnfinished(
      candidateUser._id,
      track.id,
    );
    if (existing) {
      return {
        status: 200,
        payload: this.serializeSession(existing),
      };
    }

    const resumeContext = await this.resolveResumeContext(candidateUser, body);
    if (resumeContext.status && resumeContext.status !== 200) {
      return resumeContext;
    }

    const questions = this.buildTrackQuestions(track);
    const session = await this.sessionRepository.create({
      candidateId: candidateUser._id,
      createdByAdminId: adminUser._id,
      candidateName: candidateUser.fullName,
      candidateEmail: candidateUser.email,
      trackId: track.id,
      trackTitle: track.title,
      type: track.type,
      languageCode: body.languageCode || "en-US",
      status: AI_INTERVIEW_STATUS.SCHEDULED,
      aiName: DEFAULT_AI_NAME,
      targetRole: body.targetRole || track.targetRoles?.[0] || "",
      specialization: this.deriveSpecialization(
        track,
        resumeContext.parsedProfile,
        candidateUser,
      ),
      resumeAssetId: resumeContext.asset?._id || null,
      resumeName: resumeContext.resumeName || body.resumeName || "",
      resumeUrl: resumeContext.resumeUrl || "",
      parsedResume: resumeContext.parsedProfile || {},
      trackSnapshot: this.buildTrackSnapshot(track, questions),
      questions,
      currentQuestionIndex: 0,
      durationMinutes: track.durationMinutes || 0,
      scheduledAt: new Date(),
      providerMetadata: {
        provider: "",
        mainModel: this.llmProvider.mainModel || "",
        scoreModel: this.llmProvider.scoreModel || "",
        promptVersion: this.llmProvider.getPromptVersion(),
        totalTokensUsed: 0,
        aiCallLog: [],
      },
    });

    return {
      status: 201,
      payload: this.serializeSession(session),
    };
  }

  async updateAdminDecision({ adminUserId, sessionId, status }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    const currentResult =
      session.result ||
      this.buildDeterministicReport({
        score: this.computeAggregateScore(session.answers || []),
        dimensionScores:
          session.dimensionScores || this.aggregateDimensionScores(session.answers || []),
        track: {
          title: session.trackTitle,
        },
      });

    const nextStep = this.buildNextStep(status);

    session.reviewedByAdminId = adminUserId;
    session.status = status;
    session.completedAt = session.completedAt || new Date();
    session.result = {
      ...currentResult,
      status,
      badgeLabel: this.formatDecisionLabel(status),
      nextStepTitle: nextStep.nextStepTitle,
      nextStepDescription: nextStep.nextStepDescription,
      recommendation: this.buildRecommendation(status, currentResult.score),
      generatedAt: currentResult.generatedAt || new Date(),
    };

    await this.sessionRepository.save(session);

    if (session.sessionSource === "project-application") {
      await this.syncProjectApplicationFromInterview(session);
    }

    return {
      status: 200,
      payload: this.serializeSession(session),
    };
  }

  async updateAdminNote({ adminUserId, sessionId, note }) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return { status: 404, reason: "session_not_found" };
    }

    session.reviewedByAdminId = adminUserId;
    session.adminNote = this.normalizeText(note, 2000);
    session.adminNoteUpdatedAt = new Date();
    await this.sessionRepository.save(session);

    return {
      status: 200,
      payload: {
        success: true,
      },
    };
  }
}

module.exports = new AiInterviewService();
