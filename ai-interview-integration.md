````markdown
# MyDeepTech AI Interview System  
## Full Backend + AI Integration Contract (Production Architecture)
### Version: v1.0  
### Date: April 2026  
### Stack: Node.js Backend + Groq/OpenAI LLM Layer  

---

# 1. Overview

This document defines the **full system architecture and backend contract** for the MyDeepTech AI Interview Module.

The system is a **multi-layer AI hiring engine** that:

- Parses candidate CVs
- Runs structured AI interviews
- Evaluates responses using LLMs
- Generates recruiter-ready scoring reports
- Supports admin review + override
- Stores full interview transcripts for auditability

---

# 2. System Architecture

## High-Level Flow

```text
Frontend (Vite React)
        ↓
Backend API (Node.js / NestJS / Express)
        ↓
AI Orchestration Layer
        ↓
LLM Provider Layer (Groq / OpenAI)
        ↓
Database (PostgreSQL)
        ↓
Optional Queue Worker (BullMQ / Redis)
````

---

## Core Principle

> The backend is NOT a CRUD API.
> It is an AI orchestration system.

---

# 3. AI System Design

## 3.1 AI Modules

The backend must implement 3 independent AI services:

### 1. Interviewer Agent

Responsible for:

* Generating next question
* Personalizing questions using CV
* Managing interview flow

---

### 2. Scoring Agent

Responsible for:

* Evaluating candidate responses
* Producing structured scores
* Detecting weak answers / flags

---

### 3. Report Agent

Responsible for:

* Final interview summary
* Hiring recommendation
* Strengths / weaknesses extraction

---

# 4. LLM Provider Layer

## Supported Providers

* Groq (primary - low latency)
* OpenAI (fallback / premium reasoning)

---

## Provider Abstraction

Backend must implement:

```ts
interface LLMProvider {
  generateInterviewQuestion(input): Promise<Response>
  scoreAnswer(input): Promise<Score>
  generateReport(input): Promise<Report>
}
```

---

## Groq Setup (Primary)

```ts
baseURL: "https://api.groq.com/openai/v1"
model: "openai/gpt-oss-120b"
```

Fallback:

```ts
model: "openai/gpt-oss-20b"
```

---

# 5. AI Interview Flow (Core Logic)

## Step-by-step execution

```text
1. Candidate starts session
2. CV parsed into structured JSON
3. First question generated
4. Candidate answers
5. Scoring agent evaluates answer
6. Interviewer generates next question
7. Repeat until completion
8. Report agent generates final output
```

---

## Critical Rule

> Interviewer and Scoring MUST be separate LLM calls.

Never merge scoring + question generation in one call.

---

# 6. API ARCHITECTURE

---

## 6.1 Candidate APIs

### Start Session

```http
POST /ai-interviews/sessions
```

### Get Session

```http
GET /ai-interviews/sessions/:sessionId
```

### Submit Answer

```http
POST /ai-interviews/sessions/:sessionId/answer
```

### Save Draft

```http
PATCH /ai-interviews/sessions/:sessionId/draft
```

### Get Result

```http
GET /ai-interviews/results/:sessionId
```

---

## 6.2 Admin APIs

### Overview

```http
GET /admin/ai-interviews/overview
```

### Sessions List

```http
GET /admin/ai-interviews
```

### Session Detail

```http
GET /admin/ai-interviews/:sessionId
```

### Override Decision

```http
PATCH /admin/ai-interviews/:sessionId/override
```

### Add Reviewer Note

```http
PATCH /admin/ai-interviews/:sessionId/note
```

---

## 6.3 AI Support APIs

### Resume Upload

```http
POST /ai-interviews/uploads/resume
```

### Track Fetch

```http
GET /ai-interviews/tracks
```

---

# 7. AI DATA CONTRACTS

---

## 7.1 Interview Question Response

```json
{
  "question": "Explain Zustand vs Redux",
  "contextFollowUp": true,
  "expectedDepth": "medium",
  "metadata": {
    "topic": "state management"
  }
}
```

---

## 7.2 Scoring Response

```json
{
  "scores": {
    "clarity": 8,
    "reasoning": 7,
    "domainFit": 9,
    "instructionFidelity": 8
  },
  "overallScore": 82,
  "flags": [
    "generic_response"
  ],
  "notes": "Good practical understanding but lacks depth"
}
```

---

## 7.3 Final Report

```json
{
  "score": 94,
  "recommendation": "Strong Recommend",
  "strengths": [
    "Strong React experience",
    "Good system thinking"
  ],
  "concerns": [
    "Weak backend exposure"
  ],
  "confidence": 0.87
}
```

---

# 8. CV PROCESSING PIPELINE

## Step 1: Upload

Store file in S3 / storage bucket

---

## Step 2: Parsing Service

Extract:

* Skills
* Experience
* Roles
* Projects
* Education

---

## Step 3: Structured JSON Output

```json
{
  "skills": ["React", "Node.js"],
  "experienceYears": 3,
  "roles": ["Frontend Developer"],
  "projects": []
}
```

---

# 9. DATABASE DESIGN

---

## ai_interview_sessions

```sql
id
user_id
track_id
status
score
recommendation
model
provider
prompt_version
started_at
completed_at
```

---

## ai_interview_messages

```sql
id
session_id
role (ai | candidate)
content
tokens_used
created_at
```

---

## ai_interview_scores

```sql
id
session_id
question_index
clarity
reasoning
domain_fit
flags
notes
```

---

## ai_interview_assets

```sql
id
user_id
file_url
parsed_json
created_at
```

---

# 10. QUEUE SYSTEM (RECOMMENDED)

To avoid blocking API calls:

Use:

* BullMQ (Redis)
* or background workers

---

## Jobs

### interview.generateQuestion

### interview.scoreAnswer

### interview.generateReport

---

# 11. STATUS MACHINE

```text
scheduled
not-started
in-progress
processing
submitted
passed
retry-required
action-required
```

---

# 12. PROMPT VERSIONING

Every AI call must include:

```json
{
  "promptVersion": "v1.0",
  "model": "openai/gpt-oss-120b"
}
```

---

# 13. SCORING SYSTEM

## Weighting Model

### Technical Roles

* Technical Accuracy → 40%
* Problem Solving → 25%
* Clarity → 20%
* Domain Fit → 15%

---

## Final Score Formula

```text
score = weighted average (0–100)
```

---

# 14. REAL-TIME FLOW

## Submit Answer Flow

```text
Candidate Answer
   ↓
Scoring Agent (LLM Call 1)
   ↓
Store Score
   ↓
Interviewer Agent (LLM Call 2)
   ↓
Return Next Question
```

---

# 15. PERFORMANCE REQUIREMENTS

* Response time target: < 3–5 seconds
* Use caching for CV parsing
* Parallelize scoring + logging
* Retry failed LLM calls (max 2)

---

# 16. SECURITY REQUIREMENTS

* No direct frontend LLM access
* API key stored in backend only
* Rate limit interview endpoints
* Validate session ownership
* Encrypt CV storage links

---

# 17. OBSERVABILITY

Log:

* tokens_used
* latency_ms
* model_used
* provider_used
* session_id

---

# 18. FUTURE EXTENSIONS (DO NOT BUILD IN MVP)

* Voice interview (TTS + STT)
* Real-time conversational streaming
* Webcam proctoring
* Anti-cheating detection
* Multi-language interviews
* Company-specific question banks

---

# 19. MINIMUM BACKEND BUILD CHECKLIST

## MUST SHIP FIRST

* [ ] Session creation
* [ ] Answer submission flow
* [ ] Interviewer AI agent
* [ ] Scoring AI agent
* [ ] Result generation
* [ ] Admin overview
* [ ] Admin review page
* [ ] CV parsing service

---

# 20. FINAL ARCHITECTURE SUMMARY

```text
Frontend (Vite)
     ↓
Backend API (Node.js)
     ↓
AI Orchestration Layer
     ↓
Groq (primary LLM)
     ↓
OpenAI (fallback)
     ↓
Database + Logs
```

---

# SYSTEM PRINCIPLE

> The backend is not a CRUD system.
> It is an AI decision engine with structured reasoning, scoring, and memory.

---

# END OF CONTRACT

```

---

If you want next step, I can design:

1. **Exact folder structure for backend (production-ready Node.js)**
2. **Groq + OpenAI service implementation code**
3. **Prompt library (interviewer + scorer + report generator)**
4. **Queue worker system (BullMQ setup)**

Just tell me 👍
```
