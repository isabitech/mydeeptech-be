function asJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildResumeParsingPrompt({
  promptVersion,
  profileSummary,
  extractedText,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech resume parsing agent. Extract concise, recruiter-grade structured JSON from the candidate resume. Return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Profile summary:",
        asJson(profileSummary),
        "Resume text:",
        extractedText,
        "Return strict JSON with this shape:",
        asJson({
          headline: "string",
          yearsOfExperience: 0,
          primaryRoles: ["string"],
          keySkills: ["string"],
          notableProjects: ["string"],
          education: ["string"],
          certifications: ["string"],
          industries: ["string"],
          strengths: ["string"],
          summary: "string",
        }),
      ].join("\n\n"),
    },
  ];
}

function buildInterviewerPrompt({
  promptVersion,
  candidateContext,
  track,
  baseQuestion,
  currentQuestionIndex,
  previousAnswers,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech interviewer agent. Rewrite the base interview question to fit the candidate's background while preserving the same competency target. Keep it direct, one question only, no preamble, and return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Candidate context:",
        asJson(candidateContext),
        "Track:",
        asJson({
          id: track.id,
          title: track.title,
          type: track.type,
          targetRoles: track.targetRoles,
          sectionLabels: track.sectionLabels,
        }),
        "Base question:",
        asJson(baseQuestion),
        `Question index: ${currentQuestionIndex}`,
        "Previous answers summary:",
        asJson(
          (previousAnswers || []).map((item) => ({
            questionId: item.questionId,
            answer: item.answer,
            overallScore: item.score?.overallScore,
            notes: item.score?.notes,
          })),
        ),
        "Return strict JSON with this shape:",
        asJson({
          prompt: "string",
          placeholder: "string",
          tip: "string",
        }),
      ].join("\n\n"),
    },
  ];
}

function buildScoringPrompt({
  promptVersion,
  candidateContext,
  track,
  question,
  answer,
  previousAnswers,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech scoring agent. Evaluate the candidate response. Score clarity, instruction fidelity, reasoning, and domain fit on 0-10. Score overall on 0-100. Return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Candidate context:",
        asJson(candidateContext),
        "Track:",
        asJson({
          id: track.id,
          title: track.title,
          type: track.type,
          targetRoles: track.targetRoles,
        }),
        "Question:",
        asJson(question),
        "Candidate answer:",
        answer,
        "Previous answers:",
        asJson(
          (previousAnswers || []).map((item) => ({
            questionId: item.questionId,
            answer: item.answer,
            overallScore: item.score?.overallScore,
          })),
        ),
        "Return strict JSON with this shape:",
        asJson({
          scores: {
            clarity: 0,
            instructionFidelity: 0,
            reasoning: 0,
            domainFit: 0,
          },
          overallScore: 0,
          flags: ["string"],
          notes: "string",
        }),
      ].join("\n\n"),
    },
  ];
}

function buildReportPrompt({
  promptVersion,
  candidateContext,
  track,
  answers,
  dimensionScores,
  aggregateScore,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech report agent. Produce a candidate-facing final result and final decision. Return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Candidate context:",
        asJson(candidateContext),
        "Track:",
        asJson({
          id: track.id,
          title: track.title,
          type: track.type,
          targetRoles: track.targetRoles,
          specialization: track.specialization || "",
        }),
        `Aggregate score: ${aggregateScore}`,
        "Dimension scores:",
        asJson(dimensionScores),
        "Answer transcript:",
        asJson(
          (answers || []).map((item) => ({
            questionId: item.questionId,
            questionPrompt: item.questionPrompt,
            answer: item.answer,
            score: item.score,
          })),
        ),
        "Return strict JSON with this shape:",
        asJson({
          score: 0,
          status: "passed",
          recommendation: "string",
          confidence: 0.8,
          summary: "string",
          strengths: [
            {
              title: "string",
              description: "string",
            },
          ],
          concerns: ["string"],
          nextStepTitle: "string",
          nextStepDescription: "string",
        }),
      ].join("\n\n"),
    },
  ];
}

function buildFocusLossPrompt({
  promptVersion,
  candidateContext,
  track,
  currentResult,
  events,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech interview integrity review agent. Classify the candidate session based on browser focus-loss events. Any recorded focus-loss event triggers automatic failure under current policy. Return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Candidate context:",
        asJson({
          id: candidateContext.id,
          fullName: candidateContext.fullName,
          email: candidateContext.email,
          role: candidateContext.role,
          annotatorStatus: candidateContext.annotatorStatus,
        }),
        "Track:",
        asJson({
          id: track.id,
          title: track.title,
          type: track.type,
        }),
        "Current result before policy override:",
        asJson(
          currentResult
            ? {
                score: currentResult.score,
                status: currentResult.status,
                summary: currentResult.summary,
                concerns: currentResult.concerns,
              }
            : null,
        ),
        "Focus-loss events:",
        asJson(events),
        "Return strict JSON with this shape:",
        asJson({
          classification: "integrity-failure",
          riskLevel: "critical",
          summary: "string",
          recommendation: "string",
          concerns: ["string"],
        }),
      ].join("\n\n"),
    },
  ];
}

function buildProjectTrackPrompt({
  promptVersion,
  projectContext,
  candidateContext,
}) {
  return [
    {
      role: "system",
      content:
        "You are the MyDeepTech project interview designer. Build a four-question written interview for a live annotation project using the project details provided. Questions must be specific to the project, operationally realistic, and return JSON only.",
    },
    {
      role: "user",
      content: [
        `Prompt version: ${promptVersion}`,
        "Project context:",
        asJson(projectContext),
        "Candidate context:",
        asJson(
          candidateContext
            ? {
                fullName: candidateContext.fullName,
                role: candidateContext.role,
                annotatorStatus: candidateContext.annotatorStatus,
                domains: candidateContext.domains,
                yearsOfExperience: candidateContext.yearsOfExperience,
                parsedResume: candidateContext.parsedResume,
              }
            : null,
        ),
        "Return strict JSON with this shape:",
        asJson({
          title: "string",
          subtitle: "string",
          summary: "string",
          description: "string",
          keyInstructions: ["string"],
          preparationTip: "string",
          progressLabel: "string",
          sectionLabels: ["string", "string", "string", "string"],
          questions: [
            {
              sectionTitle: "string",
              prompt: "string",
              placeholder: "string",
              tip: "string",
              suggestedMinutes: 5,
            },
          ],
        }),
      ].join("\n\n"),
    },
  ];
}

module.exports = {
  buildResumeParsingPrompt,
  buildInterviewerPrompt,
  buildScoringPrompt,
  buildReportPrompt,
  buildFocusLossPrompt,
  buildProjectTrackPrompt,
};
