const assert = require("node:assert/strict");
const aiRoutes = require("../routes/aiInterview.routes");
const adminAiRoutes = require("../routes/admin-aiInterview.routes");
const aiInterviewService = require("../services/aiInterview.service");
const {
  getAiInterviewTracks,
  buildProjectTrackFromProject,
  buildProjectTrackId,
} = require("../services/ai-interview/trackCatalog");
const {
  FINAL_DECISIONS,
  AI_INTERVIEW_STATUS,
} = require("../services/ai-interview/constants");

function flattenRoutes(router) {
  return router.stack.flatMap((layer) => {
    if (layer.route) {
      return Object.keys(layer.route.methods).map(
        (method) => `${method.toUpperCase()} ${layer.route.path}`,
      );
    }

    if (layer.name === "router" && layer.handle?.stack) {
      return flattenRoutes(layer.handle);
    }

    return [];
  });
}

function main() {
  const userRouteSet = new Set(flattenRoutes(aiRoutes));
  const adminRouteSet = new Set(flattenRoutes(adminAiRoutes));

  [
    "GET /overview",
    "GET /tracks",
    "GET /tracks/:trackId",
    "POST /sessions",
    "GET /sessions/:sessionId",
    "PATCH /sessions/:sessionId/draft",
    "POST /sessions/:sessionId/answer",
    "POST /sessions/:sessionId/focus-events",
    "GET /results/:sessionId",
    "POST /uploads/resume",
  ].forEach((route) => assert(userRouteSet.has(route), `Missing user route: ${route}`));

  [
    "GET /overview",
    "GET /",
    "GET /:sessionId",
    "POST /schedule",
    "PATCH /:sessionId/decision",
    "PATCH /:sessionId/note",
  ].forEach((route) => assert(adminRouteSet.has(route), `Missing admin route: ${route}`));

  const tracks = getAiInterviewTracks();
  assert(tracks.length >= 1, "Expected at least one AI interview track");
  assert(
    !tracks.some((trackItem) => trackItem.id === "project-python-logic"),
    "Legacy Python project interview track should be removed",
  );

  const projectTrack = buildProjectTrackFromProject({
    _id: "680f0c8f8b4d6b51e4f3a123",
    projectName: "Financial Receipt Labeling",
    projectCategory: "annotation",
    projectDescription:
      "Annotators review scanned financial receipts, extract structured fields, and flag anomalies.",
    difficultyLevel: "intermediate",
    skillsRequired: ["OCR review", "QA", "attention to detail"],
    tags: ["finance", "document-ai"],
    estimatedDuration: "4 weeks",
  });
  assert.equal(
    projectTrack.id,
    buildProjectTrackId("680f0c8f8b4d6b51e4f3a123"),
    "Project track id should be derived from the project id",
  );
  assert.equal(projectTrack.type, "project", "Project track should use project type");
  assert.equal(
    projectTrack.questions.length,
    4,
    "Project tracks should produce four interview questions",
  );

  const track = tracks[0];
  const question = aiInterviewService.buildTrackQuestions(track)[0];
  const score = aiInterviewService.buildDeterministicScore({
    question,
    answer:
      "I would restate the instruction, document edge cases, give an example, and escalate ambiguity early so quality stays consistent.",
    candidateContext: {
      parsedResume: { keySkills: ["annotation", "quality assurance"] },
      domains: ["nlp"],
    },
    track,
  });

  assert(score.overallScore >= 0 && score.overallScore <= 100, "Score out of range");

  const dimensionScores = aiInterviewService.aggregateDimensionScores([
    {
      score: {
        ...score.scores,
        overallScore: score.overallScore,
      },
    },
  ]);

  const report = aiInterviewService.buildDeterministicReport({
    score: score.overallScore,
    dimensionScores,
    track,
  });

  assert(
    FINAL_DECISIONS.includes(report.status),
    "Report produced an invalid final decision",
  );

  const focusLossAssessment =
    aiInterviewService.buildDeterministicFocusLossAssessment({
      currentResult: report,
      events: [
        {
          id: "tab-hidden-1745691840000",
          type: "tab-hidden",
          occurredAt: "2026-04-26T18:24:00.000Z",
          label:
            "Interview tab was hidden or the browser moved to another tab.",
        },
        {
          id: "window-blur-1745691900000",
          type: "window-blur",
          occurredAt: "2026-04-26T18:25:00.000Z",
          label: "Interview window lost focus.",
        },
      ],
    });

  assert.equal(
    focusLossAssessment.automaticFailure,
    true,
    "Focus-loss events should trigger automatic failure",
  );

  const focusLossResult = aiInterviewService.buildFocusLossFailureResult({
    currentResult: report,
    assessment: focusLossAssessment,
    events: [
      {
        id: "tab-hidden-1745691840000",
        type: "tab-hidden",
        occurredAt: "2026-04-26T18:24:00.000Z",
        label:
          "Interview tab was hidden or the browser moved to another tab.",
      },
      {
        id: "window-blur-1745691900000",
        type: "window-blur",
        occurredAt: "2026-04-26T18:25:00.000Z",
        label: "Interview window lost focus.",
      },
    ],
  });

  assert.equal(
    focusLossResult.status,
    AI_INTERVIEW_STATUS.ACTION_REQUIRED,
    "Focus-loss override should downgrade the final status",
  );
  assert.equal(
    focusLossResult.score,
    0,
    "Focus-loss override should zero out the final score",
  );
  assert.match(
    focusLossResult.summary,
    /automatically failed/i,
    "Focus-loss override should explain the policy failure",
  );

  console.log("AI interview module verification passed.");
}

main();
