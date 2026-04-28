const TRACK_TYPES = {
  GENERALIST: "generalist",
  PROJECT: "project",
};

const AI_INTERVIEW_STATUS = {
  SCHEDULED: "scheduled",
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  SUBMITTED: "submitted",
  PROCESSING: "processing",
  PASSED: "passed",
  RETRY_REQUIRED: "retry-required",
  ACTION_REQUIRED: "action-required",
};

const ALL_AI_INTERVIEW_STATUSES = Object.values(AI_INTERVIEW_STATUS);

const FINAL_DECISIONS = [
  AI_INTERVIEW_STATUS.PASSED,
  AI_INTERVIEW_STATUS.RETRY_REQUIRED,
  AI_INTERVIEW_STATUS.ACTION_REQUIRED,
];

const ACTIVE_SESSION_STATUSES = [
  AI_INTERVIEW_STATUS.SCHEDULED,
  AI_INTERVIEW_STATUS.NOT_STARTED,
  AI_INTERVIEW_STATUS.IN_PROGRESS,
  AI_INTERVIEW_STATUS.SUBMITTED,
  AI_INTERVIEW_STATUS.PROCESSING,
];

const ACTIONABLE_STATUSES = [
  AI_INTERVIEW_STATUS.RETRY_REQUIRED,
  AI_INTERVIEW_STATUS.ACTION_REQUIRED,
];

const DIMENSION_METADATA = [
  {
    key: "clarity",
    label: "Clarity",
    note: "How clearly the candidate structures and explains decisions.",
  },
  {
    key: "instructionFidelity",
    label: "Instruction Fidelity",
    note: "How well the candidate follows requirements and constraints.",
  },
  {
    key: "reasoning",
    label: "Reasoning",
    note: "How well the candidate justifies choices, tradeoffs, and edge cases.",
  },
  {
    key: "domainFit",
    label: "Domain Fit",
    note: "How well the candidate maps experience to annotation work quality.",
  },
];

const AI_AGENTS = {
  INTERVIEWER: "interviewer",
  SCORER: "scorer",
  REPORTER: "reporter",
  RESUME_PARSER: "resume-parser",
  FOCUS_REVIEWER: "focus-reviewer",
  PROJECT_TRACK_BUILDER: "project-track-builder",
};

const DEFAULT_AI_NAME = "Dr. Myra";
const GROQ_PROVIDER = "groq";
const DETERMINISTIC_PROVIDER = "deterministic";
const MAX_RESUME_TEXT_CHARS = 16000;
const MAX_STORED_RESUME_TEXT_CHARS = 24000;
const FOCUS_EVENT_TYPES = ["tab-hidden", "window-blur"];

module.exports = {
  TRACK_TYPES,
  AI_INTERVIEW_STATUS,
  ALL_AI_INTERVIEW_STATUSES,
  FINAL_DECISIONS,
  ACTIVE_SESSION_STATUSES,
  ACTIONABLE_STATUSES,
  DIMENSION_METADATA,
  AI_AGENTS,
  DEFAULT_AI_NAME,
  GROQ_PROVIDER,
  DETERMINISTIC_PROVIDER,
  MAX_RESUME_TEXT_CHARS,
  MAX_STORED_RESUME_TEXT_CHARS,
  FOCUS_EVENT_TYPES,
};
