require("dotenv").config();

const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");
const mongoose = require("mongoose");
const dns = require("node:dns");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const envConfig = require("../config/envConfig");
const DTUser = require("../models/dtUser.model");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const BACKEND_PORT = Number(process.env.AI_WALKTHROUGH_PORT || 4100);
const RESUME_PORT = Number(process.env.AI_WALKTHROUGH_RESUME_PORT || 4011);
const BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const RESUME_URL = `http://127.0.0.1:${RESUME_PORT}/resume.txt`;

const ADMIN_EMAIL =
  process.env.AI_WALKTHROUGH_ADMIN_EMAIL ||
  "ai.interview.admin@mydeeptech.ng";
const CANDIDATE_EMAIL =
  process.env.AI_WALKTHROUGH_CANDIDATE_EMAIL ||
  "ai.interview.annotator@example.com";
const PASSWORD = process.env.AI_WALKTHROUGH_PASSWORD || "StrongPass!123";

const resumeText = `
Ada Interviewer
Senior Data Annotator and QA Specialist
Email: ai.interview.annotator@example.com
Experience: 4 years in text annotation, content moderation, prompt evaluation, and quality review.
Skills: annotation, quality assurance, instruction following, edge case analysis, Python debugging, prompt evaluation, entity recognition, classification.
Projects:
- Reviewed multilingual LLM responses for reasoning accuracy and instruction fidelity.
- Built calibration notes for Python logic and bug triage annotation workflows.
- Mentored junior annotators on ambiguity handling and escalation discipline.
Education:
- B.Sc. Computer Science
Summary:
Structured annotator with strong written communication, quality controls, and experience documenting edge cases for technical review.
`.trim();

function logStep(message) {
  console.log(`\n[walkthrough] ${message}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 90000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
    } catch (_error) {
      // wait and retry
    }

    await delay(1500);
  }

  throw new Error(`Backend health check did not pass within ${timeoutMs}ms`);
}

async function connectDb() {
  await mongoose.connect(envConfig.mongo.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  });
}

async function ensureUser({
  email,
  fullName,
  role,
  phone,
  resumeUrl = "",
  resumeName = "",
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let user = await DTUser.findOne({ email });

  if (!user) {
    user = new DTUser({
      fullName,
      phone,
      email,
      role,
      consent: true,
      password: passwordHash,
      hasSetPassword: true,
      isEmailVerified: true,
      annotatorStatus: role === "annotator" ? "approved" : "approved",
      microTaskerStatus: "approved",
      qaStatus: "pending",
    });
  }

  user.fullName = fullName;
  user.phone = phone;
  user.role = role;
  user.consent = true;
  user.password = passwordHash;
  user.hasSetPassword = true;
  user.isEmailVerified = true;
  user.annotatorStatus = role === "annotator" ? "approved" : user.annotatorStatus || "approved";
  user.microTaskerStatus = "approved";
  user.qaStatus = user.qaStatus || "pending";

  user.personal_info = {
    ...(user.personal_info || {}),
    country: "Nigeria",
    time_zone: "Africa/Lagos",
    available_hours_per_week: 30,
    preferred_communication_channel: "email",
  };

  user.professional_background = {
    ...(user.professional_background || {}),
    education_field: "Computer Science",
    years_of_experience: 4,
    annotation_experience_types: [
      "text_annotation",
      "content_moderation",
      "translation",
    ],
  };

  user.tool_experience = ["labelbox", "appen", "custom_platforms"];
  user.annotation_skills = [
    "text_annotation",
    "classification",
    "entity_recognition",
    "content_moderation",
  ];

  user.language_proficiency = {
    ...(user.language_proficiency || {}),
    primary_language: "English",
    other_languages: ["French"],
    english_fluency_level: "fluent",
  };

  user.project_preferences = {
    ...(user.project_preferences || {}),
    domains_of_interest: ["Python Logic & Debugging", "NLP"],
    availability_type: "part_time",
    nda_signed: true,
  };

  user.attachments = {
    ...(user.attachments || {}),
    resume_url: resumeUrl || user.attachments?.resume_url || "",
    id_document_url: user.attachments?.id_document_url || "",
    work_samples_url: user.attachments?.work_samples_url || [],
  };

  if (resumeName) {
    user.resultLink = resumeName;
  }

  await user.save();
  return user;
}

function createToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      fullName: user.fullName,
    },
    envConfig.jwt.JWT_SECRET,
    { expiresIn: "2h" },
  );
}

function createClient(token) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function startResumeServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/resume.txt") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(resumeText);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(RESUME_PORT, "127.0.0.1", () => resolve(server));
  });
}

function startBackend() {
  const child = spawn(
    process.execPath,
    [path.join(process.cwd(), "index.js")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        NODE_ENV: process.env.NODE_ENV || "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[backend] ${chunk}`);
  });

  return child;
}

async function stopBackend(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill("SIGINT");
  await Promise.race([
    new Promise((resolve) => child.on("exit", resolve)),
    delay(10000),
  ]);

  if (!child.killed && child.exitCode == null) {
    child.kill("SIGTERM");
  }
}

async function runWalkthrough() {
  let resumeServer;
  let backendChild;

  try {
    logStep("Connecting to MongoDB and preparing test users");
    await connectDb();

    resumeServer = await startResumeServer();
    console.log(`[walkthrough] Resume profile server listening on ${RESUME_URL}`);

    const adminUser = await ensureUser({
      email: ADMIN_EMAIL,
      fullName: "AI Interview Admin",
      role: "admin",
      phone: "+2348000000100",
    });

    const candidateUser = await ensureUser({
      email: CANDIDATE_EMAIL,
      fullName: "AI Interview Candidate",
      role: "annotator",
      phone: "+2348000000200",
      resumeUrl: RESUME_URL,
      resumeName: "ai-interview-resume.txt",
    });

    const adminToken = createToken(adminUser);
    const candidateToken = createToken(candidateUser);

    await mongoose.disconnect();

    logStep(`Starting backend on ${BASE_URL}`);
    backendChild = startBackend();
    await waitForHealth(`${BASE_URL}/health`);
    console.log("[walkthrough] Backend health check passed");

    const adminClient = createClient(adminToken);
    const candidateClient = createClient(candidateToken);

    logStep("Fetching candidate overview and tracks");
    const overviewResponse = await candidateClient.get("/api/ai-interviews/overview");
    const tracksResponse = await candidateClient.get("/api/ai-interviews/tracks");
    const tracks = tracksResponse.data?.data || tracksResponse.data?.tracks || [];
    const generalistTrack =
      tracks.find((track) => track.id === "generalist-foundation") || tracks[0];

    console.log(
      "[walkthrough] Candidate overview stats:",
      JSON.stringify(overviewResponse.data?.stats || overviewResponse.data?.data?.stats || {}, null, 2),
    );
    console.log(
      "[walkthrough] Available tracks:",
      tracks.map((track) => track.id).join(", "),
    );

    logStep("Scheduling an interview from the admin side");
    const scheduleResponse = await adminClient.post("/api/admin/ai-interviews/schedule", {
      candidateName: candidateUser.fullName,
      candidateEmail: candidateUser.email,
      trackId: generalistTrack.id,
      languageCode: "en-US",
      targetRole: generalistTrack.targetRoles?.[0] || "Generalist Annotator",
    });
    const scheduledSession =
      scheduleResponse.data?.session || scheduleResponse.data?.data;
    console.log(
      "[walkthrough] Scheduled session:",
      JSON.stringify(
        {
          id: scheduledSession.id,
          status: scheduledSession.status,
          trackId: scheduledSession.trackId,
        },
        null,
        2,
      ),
    );

    logStep("Starting candidate session");
    const startSessionResponse = await candidateClient.post("/api/ai-interviews/sessions", {
      candidateId: String(candidateUser._id),
      candidateName: candidateUser.fullName,
      candidateEmail: candidateUser.email,
      trackId: generalistTrack.id,
      languageCode: "en-US",
      targetRole: generalistTrack.targetRoles?.[0] || "Generalist Annotator",
      resumeName: "ai-interview-resume.txt",
    });

    let session = startSessionResponse.data?.session || startSessionResponse.data?.data;
    console.log(
      "[walkthrough] Started session:",
      JSON.stringify(
        {
          id: session.id,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.totalQuestions,
          resumeName: session.resumeName,
        },
        null,
        2,
      ),
    );

    logStep("Saving a draft answer");
    const draftResponse = await candidateClient.patch(
      `/api/ai-interviews/sessions/${session.id}/draft`,
      {
        sessionId: session.id,
        draftAnswer:
          "I would first restate the instruction and identify edge cases before answering.",
      },
    );
    session = draftResponse.data?.session || draftResponse.data?.data;
    console.log(
      `[walkthrough] Draft saved. Current draft length: ${
        (session.draftAnswer || "").length
      }`,
    );

    const sampleAnswers = [
      "I explain complex annotation instructions by rewriting the core objective in simpler language, then I add a few concrete examples and edge cases so the teammate sees both the rule and the exception path. I also ask them to restate the guideline back to me so I can catch ambiguity early and document unresolved cases before work starts.",
      "When a task guideline, examples, and live data conflict, I prioritize the source of truth, compare the edge case to the closest approved example, and write a short note on why I chose a label. If the conflict can affect consistency at scale, I escalate with the exact sample, my reasoning, and the risk of each possible decision.",
      "In a previous workflow I noticed reviewers were treating instruction-following as the same thing as factual correctness. I raised it, rewrote the calibration note to separate the dimensions, and added examples showing how a technically correct answer could still fail the instruction. That reduced disagreement and made audits easier.",
      "If complexity rises and throughput drops, I reduce avoidable rework first. I tighten my checklist, batch similar edge cases, communicate risk early, and protect quality thresholds even if I need to slow down temporarily. My goal is to stay explicit about what changed, what I can still deliver reliably, and where the team needs a calibration decision.",
    ];

    logStep("Submitting answers through to final scoring");
    for (let index = 0; index < session.totalQuestions; index += 1) {
      const answerText =
        sampleAnswers[index] ||
        sampleAnswers[sampleAnswers.length - 1];

      const answerResponse = await candidateClient.post(
        `/api/ai-interviews/sessions/${session.id}/answer`,
        {
          sessionId: session.id,
          answer: answerText,
        },
      );

      session = answerResponse.data?.session || answerResponse.data?.data;
      console.log(
        `[walkthrough] Answer ${index + 1}/${session.totalQuestions} submitted -> status=${session.status}, currentQuestionIndex=${session.currentQuestionIndex}`,
      );
    }

    logStep("Submitting focus-loss events to trigger integrity failure");
    const focusEventTimestamp = Date.now();
    const focusEventsResponse = await candidateClient.post(
      `/api/ai-interviews/sessions/${session.id}/focus-events`,
      {
        sessionId: session.id,
        events: [
          {
            id: `tab-hidden-${focusEventTimestamp}`,
            type: "tab-hidden",
            occurredAt: new Date(focusEventTimestamp).toISOString(),
            label:
              "Interview tab was hidden or the browser moved to another tab.",
          },
          {
            id: `window-blur-${focusEventTimestamp + 60000}`,
            type: "window-blur",
            occurredAt: new Date(focusEventTimestamp + 60000).toISOString(),
            label: "Interview window lost focus.",
          },
        ],
      },
    );
    session = focusEventsResponse.data?.session || focusEventsResponse.data?.data;
    console.log(
      "[walkthrough] Focus-loss downgrade:",
      JSON.stringify(
        {
          id: session.id,
          status: session.status,
          score: session.result?.score,
          automaticFailure: session.focusLossAssessment?.automaticFailure,
          eventCount: session.focusLossAssessment?.eventCount,
          classification: session.focusLossAssessment?.classification,
        },
        null,
        2,
      ),
    );

    logStep("Fetching final candidate result");
    const resultResponse = await candidateClient.get(
      `/api/ai-interviews/results/${session.id}`,
    );
    const resultSession =
      resultResponse.data?.session || resultResponse.data?.data;

    console.log(
      "[walkthrough] Final result:",
      JSON.stringify(
        {
          id: resultSession.id,
          status: resultSession.status,
          score: resultSession.result?.score,
          badgeLabel: resultSession.result?.badgeLabel,
          qualificationLabel: resultSession.result?.qualificationLabel,
        },
        null,
        2,
      ),
    );

    if (resultSession.status !== "action-required" || resultSession.result?.score !== 0) {
      throw new Error("Focus-loss events did not force an automatic failure");
    }

    logStep("Fetching admin overview, list, and report");
    const [adminOverviewResponse, adminSessionsResponse, adminReportResponse] =
      await Promise.all([
        adminClient.get("/api/admin/ai-interviews/overview"),
        adminClient.get("/api/admin/ai-interviews"),
        adminClient.get(`/api/admin/ai-interviews/${session.id}`),
      ]);

    const adminOverview =
      adminOverviewResponse.data?.data || adminOverviewResponse.data;
    const adminSessions =
      adminSessionsResponse.data?.sessions ||
      adminSessionsResponse.data?.data ||
      [];
    const adminReport =
      adminReportResponse.data?.data || adminReportResponse.data;

    console.log(
      "[walkthrough] Admin overview metrics:",
      JSON.stringify(adminOverview.metrics || [], null, 2),
    );
    console.log(
      `[walkthrough] Admin sessions returned: ${adminSessions.length}`,
    );
    console.log(
      "[walkthrough] Admin report snapshot:",
      JSON.stringify(
        {
          sessionId: adminReport.session?.id,
          trackId: adminReport.track?.id,
          answerCount: adminReport.session?.answers?.length,
          dimensionCount: adminReport.session?.dimensionScores?.length,
          focusLossEventCount: adminReport.session?.focusLossEvents?.length,
          focusLossClassification:
            adminReport.session?.focusLossAssessment?.classification,
        },
        null,
        2,
      ),
    );

    logStep("Updating admin note and overriding decision");
    await adminClient.patch(`/api/admin/ai-interviews/${session.id}/note`, {
      note: "Walkthrough note: live dev verification completed and transcript reviewed.",
    });

    const decisionResponse = await adminClient.patch(
      `/api/admin/ai-interviews/${session.id}/decision`,
      {
        sessionId: session.id,
        status: "retry-required",
      },
    );
    const overriddenSession =
      decisionResponse.data?.session || decisionResponse.data?.data;

    console.log(
      "[walkthrough] Overridden decision:",
      JSON.stringify(
        {
          id: overriddenSession.id,
          status: overriddenSession.status,
          resultStatus: overriddenSession.result?.status,
        },
        null,
        2,
      ),
    );

    logStep("Walkthrough completed successfully");
    console.log(
      JSON.stringify(
        {
          backendBaseUrl: BASE_URL,
          resumeUrl: RESUME_URL,
          adminEmail: ADMIN_EMAIL,
          candidateEmail: CANDIDATE_EMAIL,
          sessionId: session.id,
          focusLossEventCount: resultSession.focusLossEvents?.length || 0,
          finalStatusBeforeOverride: resultSession.status,
          finalScoreBeforeOverride: resultSession.result?.score,
          finalStatusAfterOverride: overriddenSession.status,
        },
        null,
        2,
      ),
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }

    if (resumeServer) {
      await new Promise((resolve) => resumeServer.close(resolve));
    }

    if (backendChild) {
      await stopBackend(backendChild);
    }
  }
}

runWalkthrough().catch((error) => {
  console.error("\n[walkthrough] Failed:", error.response?.data || error.message);
  process.exit(1);
});
