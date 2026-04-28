const { TRACK_TYPES } = require("./constants");

const BASE_TRACKS = [
  {
    id: "generalist-foundation",
    title: "Generalist Interview",
    subtitle: "Platform screening and readiness evaluation",
    description:
      "Assesses communication, instruction fidelity, reasoning quality, and operational readiness for platform-based annotation work.",
    summary:
      "Core screening interview for annotators entering the MyDeepTech workflow.",
    type: TRACK_TYPES.GENERALIST,
    levelLabel: "Foundation Level",
    badgeReward: "Verified Badge Reward",
    introId: "MDT-402-AI",
    durationMinutes: 18,
    multiplierLabel: "1x Multiplier",
    targetRoles: ["Generalist Annotator"],
    keyInstructions: [
      "Do not use external AI tools while answering.",
      "Answer with concrete examples from your work history.",
      "Be explicit about quality checks, edge cases, and tradeoffs.",
    ],
    readinessChecklist: [
      {
        id: "generalist-ready-1",
        title: "Stable internet connection",
        description: "Use a reliable network before starting the session.",
      },
      {
        id: "generalist-ready-2",
        title: "Quiet working environment",
        description: "Prepare a focused environment for uninterrupted writing.",
      },
      {
        id: "generalist-ready-3",
        title: "Resume already uploaded",
        description: "Your profile resume is used to personalize the interview.",
      },
    ],
    preparationTip:
      "Review your last few annotation or QA tasks before you begin.",
    progressLabel: "Complete this to unlock deeper project interviews.",
    sectionLabels: [
      "Communication Alignment",
      "Workflow Reasoning",
      "Quality Judgment",
      "Reliability & Growth",
    ],
    heroVariant: "generalist",
    questions: [
      {
        id: "generalist-q1",
        sectionTitle: "Communication Alignment",
        prompt:
          "Describe how you would explain a complex annotation instruction to a new teammate without losing any important detail.",
        placeholder: "Explain your communication approach clearly.",
        tip: "Use a real or realistic task scenario and show how you avoid ambiguity.",
        suggestedMinutes: 4,
      },
      {
        id: "generalist-q2",
        sectionTitle: "Workflow Reasoning",
        prompt:
          "Walk me through how you handle conflicting signals between a task guideline, edge-case examples, and the raw data in front of you.",
        placeholder: "Show the order of decisions you would make.",
        tip: "Focus on process, escalation points, and how you document uncertainty.",
        suggestedMinutes: 4,
      },
      {
        id: "generalist-q3",
        sectionTitle: "Quality Judgment",
        prompt:
          "Tell me about a time you found an error, inconsistency, or weak assumption in a workflow and what you did next.",
        placeholder: "Describe the issue, your reasoning, and the outcome.",
        tip: "Strong answers show ownership and quality control discipline.",
        suggestedMinutes: 5,
      },
      {
        id: "generalist-q4",
        sectionTitle: "Reliability & Growth",
        prompt:
          "If your throughput drops while task complexity increases, how do you protect quality without missing delivery expectations?",
        placeholder: "Explain the tradeoffs and the operating choices you would make.",
        tip: "Discuss prioritization, communication, and measurable quality safeguards.",
        suggestedMinutes: 5,
      },
    ],
  },
];

function cloneTrack(track) {
  return JSON.parse(JSON.stringify(track));
}

function buildProjectTrackId(projectId) {
  return `project-${String(projectId)}`;
}

function extractProjectIdFromTrackId(trackId = "") {
  const value = String(trackId || "").trim();
  if (!value.startsWith("project-")) {
    return null;
  }

  const projectId = value.slice("project-".length).trim();
  return projectId || null;
}

function isProjectTrackId(trackId = "") {
  return Boolean(extractProjectIdFromTrackId(trackId));
}

function inferTargetRoles(user, track) {
  if (!user) {
    return track.targetRoles;
  }

  if (track.type === TRACK_TYPES.PROJECT) {
    const domains =
      user.project_preferences?.domains_of_interest ||
      user.domains ||
      [];
    const focus = domains.find(Boolean);
    if (focus) {
      return [`${focus} Specialist`];
    }
  }

  return track.targetRoles;
}

function buildProjectTrackFromProject(project = {}) {
  const projectId = String(project._id || project.id || "");
  const projectName = project.projectName || "Project";
  const category = project.projectCategory || "Annotation";
  const difficultyLevel = project.difficultyLevel || "intermediate";
  const requiredSkills = Array.isArray(project.requiredSkills)
    ? project.requiredSkills.filter(Boolean)
    : [];
  const languageRequirements = Array.isArray(project.languageRequirements)
    ? project.languageRequirements.filter(Boolean)
    : [];
  const firstSkill =
    requiredSkills.find(Boolean) ||
    category ||
    "annotation quality";
  const roleLabel = `${category} Annotator`;
  const durationMinutes =
    difficultyLevel === "expert"
      ? 24
      : difficultyLevel === "advanced"
        ? 22
        : difficultyLevel === "beginner"
          ? 18
          : 20;
  const trackId = buildProjectTrackId(projectId);
  const introId = `MDT-PRJ-${projectId.slice(-6).toUpperCase() || "LIVE"}`;
  const summaryLead =
    String(project.projectDescription || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220) || `AI interview for ${projectName}.`;

  return {
    id: trackId,
    title: `${projectName} AI Interview`,
    subtitle: `${category} project readiness evaluation`,
    description:
      `Assesses whether the candidate can work successfully on ${projectName} using the live project brief, requirements, and quality expectations. ${summaryLead}`,
    summary:
      `Project-specific interview generated from the ${projectName} brief and requirements.`,
    type: TRACK_TYPES.PROJECT,
    levelLabel: "Project Specialist",
    badgeReward: "Project Interview Gate",
    introId,
    durationMinutes,
    multiplierLabel: "Project Match",
    targetRoles: [roleLabel],
    specialization: firstSkill,
    keyInstructions: [
      `Ground every answer in the ${projectName} project brief and expected workflow.`,
      "Be explicit about instruction fidelity, quality checks, and escalation points.",
      "Do not use external AI tools while answering.",
    ],
    readinessChecklist: [
      {
        id: `${trackId}-ready-1`,
        title: "Project brief reviewed",
        description:
          "Read the project description, category, and quality expectations before you begin.",
      },
      {
        id: `${trackId}-ready-2`,
        title: "Resume context available",
        description:
          "Your profile resume is used to personalize the project interview.",
      },
      {
        id: `${trackId}-ready-3`,
        title: "Focused writing session",
        description:
          "This interview is used to decide whether your project application moves forward.",
      },
    ],
    preparationTip:
      requiredSkills.length > 0
        ? `Review examples related to ${requiredSkills.slice(0, 3).join(", ")} before starting.`
        : `Review the project brief for ${projectName} before starting.`,
    progressLabel:
      "Pass this interview to send your project application to admin review.",
    sectionLabels: [
      "Project Understanding",
      "Instruction Fidelity",
      "Quality Judgment",
      "Risk & Escalation",
    ],
    heroVariant: "project",
    projectContext: {
      projectId,
      projectName,
      projectCategory: category,
      projectDescription: project.projectDescription || "",
      difficultyLevel,
      requiredSkills,
      minimumExperience: project.minimumExperience || "none",
      languageRequirements,
      payRate: project.payRate || 0,
      payRateCurrency: project.payRateCurrency || "USD",
      payRateType: project.payRateType || "per_task",
      tags: Array.isArray(project.tags) ? project.tags : [],
      guidelineLink: project.projectGuidelineLink || "",
      trackerLink: project.projectTrackerLink || "",
    },
    questions: [
      {
        id: `${trackId}-q1`,
        sectionTitle: "Project Understanding",
        prompt:
          `Based on the ${projectName} brief, how would you explain the core task, the expected output quality, and the biggest delivery risks to a new teammate before work begins?`,
        placeholder:
          "Summarize the project clearly and show that you understand what success looks like.",
        tip:
          "Strong answers connect the project description to concrete execution choices.",
        suggestedMinutes: 5,
      },
      {
        id: `${trackId}-q2`,
        sectionTitle: "Instruction Fidelity",
        prompt:
          `This project depends on ${firstSkill}. Walk me through how you would follow the project rules consistently when the brief, examples, and live data do not line up perfectly.`,
        placeholder:
          "Explain your decision order, your notes, and your escalation point.",
        tip:
          "Keep the answer grounded in the project brief rather than general interview advice.",
        suggestedMinutes: 5,
      },
      {
        id: `${trackId}-q3`,
        sectionTitle: "Quality Judgment",
        prompt:
          `What quality-control checks would you use on ${projectName} before you consider a batch ready for review, and how would those checks change for a ${difficultyLevel} project?`,
        placeholder:
          "Describe the checklist, failure signals, and what you would document.",
        tip:
          "Show how you prevent repeat errors, not just how you spot a single bad item.",
        suggestedMinutes: 5,
      },
      {
        id: `${trackId}-q4`,
        sectionTitle: "Risk & Escalation",
        prompt:
          languageRequirements.length > 0
            ? `If the project requires ${languageRequirements.join(", ")}, how do you escalate uncertainty, ambiguous labels, or quality risks without slowing the team down?`
            : `If work on ${projectName} starts to drift in quality or consistency, what evidence do you gather before escalating and what would your escalation note contain?`,
        placeholder:
          "Describe the evidence, the escalation note, and the decision you want from reviewers.",
        tip:
          "Focus on auditability, consistency, and protecting project quality at scale.",
        suggestedMinutes: 5,
      },
    ],
  };
}

function getAiInterviewTracks(user = null) {
  return BASE_TRACKS.map((track) => {
    const nextTrack = cloneTrack(track);
    nextTrack.targetRoles = inferTargetRoles(user, nextTrack);
    return nextTrack;
  });
}

function getAiInterviewTrackById(trackId, user = null) {
  const track = getAiInterviewTracks(user).find((item) => item.id === trackId);
  return track ? cloneTrack(track) : null;
}

module.exports = {
  getAiInterviewTracks,
  getAiInterviewTrackById,
  buildProjectTrackId,
  isProjectTrackId,
  extractProjectIdFromTrackId,
  buildProjectTrackFromProject,
  cloneTrack,
};
