# AI Interview API Contract

## Purpose

This document defines the backend contract required by the frontend AI Interview
module that now exists in the Vite app.

The frontend currently supports:

- Annotator interview hub
- Annotator interview setup
- Annotator live session
- Annotator results
- Admin interview overview
- Admin interview management
- Admin interview report / reviewer notes

The frontend uses mock data by default through
`VITE_AI_INTERVIEW_USE_MOCKS !== "false"`.
Once backend endpoints below are available, set:

```env
VITE_AI_INTERVIEW_USE_MOCKS=false
```

and keep the response shapes below intact.

## Frontend Routes

Annotator routes:

- `/dashboard/ai-interview`
- `/dashboard/ai-interview/setup/:trackId`
- `/dashboard/ai-interview/session/:sessionId`
- `/dashboard/ai-interview/results/:sessionId`

Admin routes:

- `/admin/interviews`
- `/admin/interviews/candidates`
- `/admin/interviews/:sessionId`

## Authentication

- Annotator endpoints require authenticated DT user session.
- Admin endpoints require authenticated admin session.
- Do not expose OpenAI or any LLM provider directly to the browser.
- All AI scoring, transcript evaluation, and result persistence must happen on the backend.

## Response Envelope

The frontend is tolerant of either:

1. Raw payloads
2. Standard wrapper payloads shaped like:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

The current frontend unwraps `response.data ?? response`.

## Core Enums

### `AiInterviewTrackType`

- `generalist`
- `project`

### `AiInterviewStatus`

- `scheduled`
- `not-started`
- `in-progress`
- `submitted`
- `processing`
- `passed`
- `retry-required`
- `action-required`

### `AiInterviewDecision`

- `passed`
- `retry-required`
- `action-required`

## Shared Shapes

### Track

```json
{
  "id": "generalist-foundation",
  "title": "Generalist Interview",
  "subtitle": "Platform screening and readiness evaluation",
  "description": "Long form description",
  "summary": "Short card summary",
  "type": "generalist",
  "levelLabel": "Foundation Level",
  "badgeReward": "Verified Badge Reward",
  "introId": "MDT-402-AI",
  "durationMinutes": 18,
  "multiplierLabel": "1x Multiplier",
  "targetRoles": ["Generalist Annotator"],
  "keyInstructions": ["Do not use external AI tools"],
  "readinessChecklist": [
    {
      "id": "generalist-ready-1",
      "title": "Stable internet connection",
      "description": "Checklist copy"
    }
  ],
  "preparationTip": "Tip text",
  "progressLabel": "Unlock copy",
  "sectionLabels": [
    "Communication Alignment",
    "Behavioural Assessment"
  ],
  "heroVariant": "generalist",
  "questions": [
    {
      "id": "generalist-q1",
      "sectionTitle": "Communication Alignment",
      "prompt": "Question text",
      "placeholder": "Textarea placeholder",
      "tip": "Tip text",
      "suggestedMinutes": 4
    }
  ]
}
```

### Session

```json
{
  "id": "ai-session-abc123",
  "candidateId": "user_123",
  "candidateName": "Jane Doe",
  "candidateEmail": "jane@example.com",
  "trackId": "generalist-foundation",
  "trackTitle": "Generalist Interview",
  "type": "generalist",
  "languageCode": "en-US",
  "status": "in-progress",
  "aiName": "Dr. Myra",
  "targetRole": "Generalist Annotator",
  "specialization": "Python Logic & Debugging",
  "resumeName": "jane_cv.pdf",
  "currentQuestionIndex": 1,
  "totalQuestions": 4,
  "durationMinutes": 18,
  "answers": [
    {
      "questionId": "generalist-q1",
      "answer": "Candidate answer",
      "submittedAt": "2026-04-26T18:30:00.000Z"
    }
  ],
  "draftAnswer": "",
  "startedAt": "2026-04-26T18:24:00.000Z",
  "updatedAt": "2026-04-26T18:30:00.000Z",
  "completedAt": null,
  "dimensionScores": [
    {
      "label": "Clarity",
      "score": 8,
      "note": "How clearly the candidate structures and explains decisions."
    }
  ],
  "result": null
}
```

### Result

```json
{
  "score": 94,
  "status": "passed",
  "badgeLabel": "Passed",
  "qualificationLabel": "Tier 1 Qualified",
  "percentileLabel": "Top 5% of recent applicants this month",
  "summary": "Candidate-facing result summary",
  "strengths": [
    {
      "title": "Clear communication style",
      "description": "Strength copy"
    }
  ],
  "concerns": ["Concern copy"],
  "nextStepTitle": "Unlock Higher Earnings",
  "nextStepDescription": "Next step copy",
  "moduleProgress": 45
}
```

## Annotator Endpoints

### 1. Get Candidate Overview

`GET /ai-interviews/overview`

Return:

```json
{
  "stats": {
    "completed": 4,
    "pending": 1,
    "passed": 2,
    "actionRequired": 1
  },
  "tracks": [],
  "recentActivity": [
    {
      "id": "ai-session-abc123",
      "title": "Generalist Interview",
      "type": "generalist",
      "attemptedAt": "2026-04-20T10:00:00.000Z",
      "status": "passed",
      "score": 94
    }
  ]
}
```

Notes:

- Backend should infer candidate identity from auth token.
- `tracks` should include all available interview tracks for that user.

### 2. Get All Tracks

`GET /ai-interviews/tracks`

Return:

- `Track[]`

### 3. Get One Track

`GET /ai-interviews/tracks/:trackId`

Return:

- `Track`

### 4. Start Session

`POST /ai-interviews/sessions`

Request:

```json
{
  "candidateId": "user_123",
  "candidateName": "Jane Doe",
  "candidateEmail": "jane@example.com",
  "trackId": "generalist-foundation",
  "languageCode": "en-US",
  "targetRole": "Generalist Annotator",
  "resumeName": "jane_cv.pdf"
}
```

Return:

- `Session`

Backend behavior:

- Create a new session or resume the latest unfinished session for the same user and track.
- Set `status` to `in-progress`.
- Set `currentQuestionIndex` to `0` for a new session.

### 5. Get Session

`GET /ai-interviews/sessions/:sessionId`

Return:

- `Session`

### 6. Save Draft

`PATCH /ai-interviews/sessions/:sessionId/draft`

Request:

```json
{
  "sessionId": "ai-session-abc123",
  "draftAnswer": "Current unsent answer"
}
```

Return:

- Updated `Session`

Notes:

- This is optional for scoring.
- It exists because the frontend exposes a "Save Progress" action.

### 7. Submit Answer

`POST /ai-interviews/sessions/:sessionId/answer`

Request:

```json
{
  "sessionId": "ai-session-abc123",
  "answer": "Candidate answer text"
}
```

Return:

- Updated `Session`

Important frontend expectation:

- For intermediate questions:
  - Increment `currentQuestionIndex`
  - Keep `status` as `in-progress`
  - Return updated partial `dimensionScores` if available
- For the final question:
  - Return the final `result` in the same response
  - Set `status` to one of `passed`, `retry-required`, or `action-required`
  - Set `completedAt`

If backend scoring is asynchronous and you return only `submitted` or `processing`
after the final answer, the current frontend will need a small change. For
seamless integration with the existing UI, return the final `result`
synchronously on the final answer submission.

### 8. Get Result

`GET /ai-interviews/results/:sessionId`

Return:

- Final `Session` including `result`

## Admin Endpoints

### 9. Get Admin Overview

`GET /admin/ai-interviews/overview`

Return:

```json
{
  "metrics": [
    {
      "id": "total",
      "label": "Total Interviews",
      "value": "1284",
      "delta": "+12%",
      "tone": "positive"
    }
  ],
  "trend": [
    {
      "label": "Mon",
      "interviews": 14
    }
  ],
  "topSkillMatch": [
    {
      "label": "Python Logic & Debugging",
      "value": 88
    }
  ],
  "recentSubmissions": []
}
```

Notes:

- `value` in `topSkillMatch` is treated as a 0-100 visual score in the current UI.
- `recentSubmissions` should be an array of `Session`.

### 10. Get Admin Session List

`GET /admin/ai-interviews`

Minimum requirement:

- Return `Session[]`

Recommended query support for scale:

- `search`
- `type`
- `status`
- `from`
- `to`
- `page`
- `limit`

The current frontend filters client-side, so returning the full list is enough
to ship the first backend version.

### 11. Get Admin Report

`GET /admin/ai-interviews/:sessionId`

Return:

```json
{
  "session": {},
  "track": {},
  "adminNote": "Reviewer note text"
}
```

Notes:

- `session.dimensionScores` must already exist here.
- `session.answers` and `track.questions` together power the transcript review UI.

### 12. Schedule Interview

`POST /admin/ai-interviews/schedule`

Request:

```json
{
  "candidateName": "Jane Doe",
  "candidateEmail": "jane@example.com",
  "trackId": "project-python-logic",
  "languageCode": "en-US",
  "targetRole": "Python Annotation Specialist"
}
```

Return:

- New `Session`

Backend behavior:

- Set `status` to `scheduled`
- `answers` should be empty
- `currentQuestionIndex` should be `0`

### 13. Update Admin Decision

`PATCH /admin/ai-interviews/:sessionId/decision`

Request:

```json
{
  "sessionId": "ai-session-abc123",
  "status": "retry-required"
}
```

Return:

- Updated `Session`

Notes:

- This endpoint is used from the admin report page.
- The backend should update both `session.status` and `result.status`.

### 14. Update Admin Note

`PATCH /admin/ai-interviews/:sessionId/note`

Request:

```json
{
  "note": "Reviewer notes and calibration comments"
}
```

Return:

```json
{
  "success": true
}
```

## Status Transition Rules

Recommended flow:

1. `scheduled`
2. `in-progress`
3. Final candidate result:
   - `passed`
   - `retry-required`
   - `action-required`

Optional review states if your backend needs them:

- `submitted`
- `processing`

Current frontend support:

- Admin screens support all states above.
- Candidate result screen expects a resolved final result, not a pending review state.

## Scoring Rules

The frontend assumes:

- `result.score` is 0-100
- `dimensionScores[].score` is 0-10

Suggested dimension labels:

- `Clarity`
- `Instruction Fidelity`
- `Reasoning`
- `Domain Fit`

These exact labels are not strictly required, but using them will keep the UI
copy natural without any frontend edits.

## Resume / CV Handling

The current frontend sends only `resumeName` during mock-mode starts.

Recommended backend extension path:

1. Add upload endpoint:
   - `POST /ai-interviews/uploads/resume`
2. Return:
   - `resumeAssetId`
   - `resumeName`
3. Extend `POST /ai-interviews/sessions` to accept:

```json
{
  "resumeAssetId": "asset_123"
}
```

This can be introduced without reworking the current page layout.

## RBAC / Admin Sidebar Requirement

Admin sidebar currently includes a local fallback route for AI Interview so the
feature is accessible before RBAC resources are provisioned.

Backend should still create a formal RBAC resource for long-term consistency:

- `title`: `AI Interview`
- `link`: `/interviews`
- `resourceKey`: `interviews`

Recommended child resources:

- `/interviews/candidates`
- `/interviews/:sessionId`

## Frontend Files Using This Contract

Primary implementation lives under:

- [src/features/aiInterview](</C:/Users/HP/Documents/MyDeep Tech/mydeeptech/src/features/aiInterview>)

Route integration:

- [src/AnimatedRoutes.tsx](</C:/Users/HP/Documents/MyDeep Tech/mydeeptech/src/AnimatedRoutes.tsx:1>)

Endpoint registry:

- [src/store/api/endpoints.ts](</C:/Users/HP/Documents/MyDeep Tech/mydeeptech/src/store/api/endpoints.ts:1>)

## Minimum Backend Checklist

Ship these first for a seamless integration:

1. `GET /ai-interviews/overview`
2. `GET /ai-interviews/tracks`
3. `POST /ai-interviews/sessions`
4. `GET /ai-interviews/sessions/:sessionId`
5. `PATCH /ai-interviews/sessions/:sessionId/draft`
6. `POST /ai-interviews/sessions/:sessionId/answer`
7. `GET /ai-interviews/results/:sessionId`
8. `GET /admin/ai-interviews/overview`
9. `GET /admin/ai-interviews`
10. `GET /admin/ai-interviews/:sessionId`
11. `PATCH /admin/ai-interviews/:sessionId/decision`
12. `PATCH /admin/ai-interviews/:sessionId/note`

Optional but useful:

13. `POST /admin/ai-interviews/schedule`
14. `POST /ai-interviews/uploads/resume`
