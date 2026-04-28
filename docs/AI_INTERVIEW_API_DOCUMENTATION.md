# AI Interview API Documentation

## Overview

This document describes the AI interview endpoints currently implemented in the
backend.

Base path:

```text
/api
```

Route groups:

- Candidate routes: `/api/ai-interviews`
- Admin routes: `/api/admin/ai-interviews`

AI provider:

- Groq
- Environment keys used by the backend:
  - `GROQ_API_KEY`
  - `AI_MODEL_MAIN`
  - `AI_MODEL_SCORE`

Core backend behavior:

- Candidate and admin identities come from auth middleware.
- Admin and annotator records are resolved from `DTUser`.
- Candidate resume context is resolved from the user profile or uploaded resume.
- Resume content is parsed and fed into the AI interview flow.
- Focus-loss events are persisted and trigger automatic failure immediately.

## Authentication

Candidate endpoints require a valid user token.

Admin endpoints require a valid admin token.

## Response Envelope

Most endpoints return the standard backend wrapper:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Some handlers also expose aliased root keys for frontend convenience, for
example:

```json
{
  "success": true,
  "message": "AI interview session ready",
  "data": {
    "id": "session_id"
  },
  "session": {
    "id": "session_id"
  }
}
```

## Enums

### Track Type

- `generalist`
- `project`

### Session Status

- `scheduled`
- `not-started`
- `in-progress`
- `submitted`
- `processing`
- `passed`
- `retry-required`
- `action-required`

### Final Decision

- `passed`
- `retry-required`
- `action-required`

### Supported Focus-Loss Event Types

- `tab-hidden`
- `window-blur`

## Shared Shapes

### Track

```json
{
  "id": "generalist-foundation",
  "title": "Generalist Interview",
  "subtitle": "Platform screening and readiness evaluation",
  "description": "Long-form description",
  "summary": "Short summary",
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
  "sectionLabels": ["Communication Alignment", "Behavioral Assessment"],
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
  "moduleProgress": 100,
  "recommendation": "Strong Recommend",
  "confidence": 0.91
}
```

### Focus-Loss Event

```json
{
  "id": "tab-hidden-1745691840000",
  "type": "tab-hidden",
  "occurredAt": "2026-04-26T18:24:00.000Z",
  "label": "Interview tab was hidden or the browser moved to another tab."
}
```

### Focus-Loss Assessment

```json
{
  "hasFocusLoss": true,
  "automaticFailure": true,
  "eventCount": 2,
  "distinctEventTypes": ["tab-hidden", "window-blur"],
  "classification": "integrity-failure",
  "riskLevel": "critical",
  "summary": "Focus-loss events were detected during the interview.",
  "recommendation": "Fail the session immediately and require a fresh interview attempt.",
  "concerns": [
    "Detected 2 focus-loss event(s) across tab hidden, window blur behavior."
  ],
  "previousStatus": "passed",
  "previousScore": 69,
  "reviewedAt": "2026-04-26T18:30:00.000Z"
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
  "status": "action-required",
  "aiName": "Dr. Myra",
  "targetRole": "Generalist Annotator",
  "specialization": "Python Logic & Debugging",
  "resumeName": "jane_cv.pdf",
  "resumeUrl": "https://example.com/jane_cv.pdf",
  "currentQuestionIndex": 3,
  "totalQuestions": 4,
  "answers": [
    {
      "questionId": "generalist-q1",
      "questionPrompt": "Question text",
      "sectionTitle": "Communication Alignment",
      "answer": "Candidate answer",
      "submittedAt": "2026-04-26T18:30:00.000Z",
      "score": {
        "clarity": 8,
        "instructionFidelity": 8,
        "reasoning": 7,
        "domainFit": 8,
        "overallScore": 79,
        "flags": [],
        "notes": "Solid baseline answer."
      }
    }
  ],
  "draftAnswer": "",
  "startedAt": "2026-04-26T18:24:00.000Z",
  "updatedAt": "2026-04-26T18:30:00.000Z",
  "completedAt": "2026-04-26T18:31:00.000Z",
  "durationMinutes": 18,
  "dimensionScores": [
    {
      "key": "clarity",
      "label": "Clarity",
      "score": 8,
      "note": "How clearly the candidate structures and explains decisions."
    }
  ],
  "result": {
    "score": 0,
    "status": "action-required",
    "badgeLabel": "Failed Integrity Check",
    "qualificationLabel": "Integrity Failure",
    "percentileLabel": "Session invalidated by focus-loss policy",
    "summary": "Focus-loss events were detected during the interview and the session was automatically failed.",
    "strengths": [],
    "concerns": [
      "Focus-loss policy triggered automatic failure after 2 event(s): tab hidden, window blur."
    ],
    "nextStepTitle": "Interview Invalidated",
    "nextStepDescription": "Focus-loss events were detected during the session. A fresh interview attempt is required.",
    "moduleProgress": 100,
    "recommendation": "Fail - Integrity Policy",
    "confidence": 0.99
  },
  "focusLossEvents": [
    {
      "id": "tab-hidden-1745691840000",
      "type": "tab-hidden",
      "occurredAt": "2026-04-26T18:24:00.000Z",
      "label": "Interview tab was hidden or the browser moved to another tab."
    }
  ],
  "focusLossAssessment": {
    "hasFocusLoss": true,
    "automaticFailure": true,
    "eventCount": 1,
    "distinctEventTypes": ["tab-hidden"],
    "classification": "integrity-failure",
    "riskLevel": "critical",
    "summary": "Focus-loss events were detected during the interview.",
    "recommendation": "Fail the session immediately and require a fresh interview attempt.",
    "concerns": [
      "Detected 1 focus-loss event(s) across tab hidden behavior."
    ],
    "previousStatus": "passed",
    "previousScore": 69,
    "reviewedAt": "2026-04-26T18:31:00.000Z"
  },
  "questions": [
    {
      "id": "generalist-q1",
      "sectionTitle": "Communication Alignment",
      "prompt": "Question text",
      "placeholder": "Textarea placeholder",
      "tip": "Tip text",
      "suggestedMinutes": 4,
      "generatedByAi": true
    }
  ],
  "track": {
    "id": "generalist-foundation",
    "title": "Generalist Interview"
  }
}
```

## Candidate Endpoints

### 1. Get Candidate Overview

`GET /api/ai-interviews/overview`

Returns candidate metrics, available tracks, and recent completed activity.

Response `data` shape:

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

### 2. Get All Tracks

`GET /api/ai-interviews/tracks`

Returns:

- `Track[]`

Aliased root key:

- `tracks`

### 3. Get One Track

`GET /api/ai-interviews/tracks/:trackId`

Returns:

- `Track`

Aliased root key:

- `track`

### 4. Start or Resume Session

`POST /api/ai-interviews/sessions`

Request:

```json
{
  "candidateId": "optional",
  "candidateName": "optional",
  "candidateEmail": "optional",
  "trackId": "generalist-foundation",
  "languageCode": "en-US",
  "targetRole": "Generalist Annotator",
  "resumeName": "jane_cv.pdf",
  "resumeAssetId": "optional_uploaded_resume_asset_id"
}
```

Notes:

- Candidate identity is taken from auth.
- If an unfinished session already exists for the same candidate and track, that
  session is returned instead of creating a duplicate.
- Resume context is resolved from the uploaded asset or the DTUser profile.
- The first question may be personalized by AI before the session is returned.

Returns:

- `Session`

Aliased root key:

- `session`

### 5. Get Session

`GET /api/ai-interviews/sessions/:sessionId`

Returns:

- `Session`

Aliased root key:

- `session`

### 6. Save Draft

`PATCH /api/ai-interviews/sessions/:sessionId/draft`

Request:

```json
{
  "sessionId": "optional",
  "draftAnswer": "Current textarea content"
}
```

Notes:

- Returns `409` if the session is already completed.

Returns:

- `Session`

Aliased root key:

- `session`

### 7. Submit Answer

`POST /api/ai-interviews/sessions/:sessionId/answer`

Request:

```json
{
  "sessionId": "optional",
  "answer": "Candidate answer text"
}
```

Behavior:

- Scores the submitted answer.
- Updates `answers`, `dimensionScores`, and question progression.
- On the final question, generates the final report.
- If focus-loss events already exist on the session, finalization will still
  apply the integrity policy before returning the session.

Returns:

- `Session`

Aliased root key:

- `session`

### 7A. Submit Focus-Loss Events

`POST /api/ai-interviews/sessions/:sessionId/focus-events`

Request:

```json
{
  "sessionId": "optional",
  "events": [
    {
      "id": "tab-hidden-1745691840000",
      "type": "tab-hidden",
      "occurredAt": "2026-04-26T18:24:00.000Z",
      "label": "Interview tab was hidden or the browser moved to another tab."
    },
    {
      "id": "window-blur-1745691900000",
      "type": "window-blur",
      "occurredAt": "2026-04-26T18:25:00.000Z",
      "label": "Interview window lost focus."
    }
  ]
}
```

Behavior:

- Persists the full focus-loss event list on the session.
- Merges and de-duplicates events by `id`.
- Sends the event set into the AI integrity classifier.
- If any supported event is present, the backend automatically fails the
  session.
- Automatic failure is represented as:
  - `session.status = "action-required"`
  - `result.status = "action-required"`
  - `result.score = 0`
  - `result.badgeLabel = "Failed Integrity Check"`
- The endpoint can update an already completed session.
- The latest `focusLossEvents`, `focusLossAssessment`, and `result` are returned
  immediately so the frontend result page can reflect the downgrade.

Returns:

- `Session`

Aliased root key:

- `session`

### 8. Get Result

`GET /api/ai-interviews/results/:sessionId`

Returns:

- `Session`

Aliased root key:

- `session`

Notes:

- This currently returns the serialized session, including `result`,
  `focusLossEvents`, and `focusLossAssessment`.

### 9. Upload Resume

`POST /api/ai-interviews/uploads/resume`

Content type:

- `multipart/form-data`

Accepted file fields:

- `resume`
- `cv`
- `document`
- `file`

Returns:

```json
{
  "resumeAssetId": "asset_id",
  "resumeName": "jane_cv.pdf",
  "resumeUrl": "https://...",
  "parsedResume": {
    "headline": "Senior Data Annotator",
    "yearsOfExperience": 4
  },
  "cloudinaryData": {}
}
```

Notes:

- Upload is rejected if Cloudinary is not configured.
- The uploaded resume is parsed and stored as an AI interview asset.

## Admin Endpoints

### 10. Get Admin Overview

`GET /api/admin/ai-interviews/overview`

Returns dashboard summary data.

Response `data` shape:

```json
{
  "metrics": [
    {
      "id": "total",
      "label": "Total Interviews",
      "value": "3",
      "delta": "+100%",
      "tone": "positive"
    }
  ],
  "trend": [
    {
      "label": "Mon",
      "interviews": 2
    }
  ],
  "topSkillMatch": [
    {
      "label": "Python Logic & Debugging",
      "value": 82
    }
  ],
  "recentSubmissions": []
}
```

### 11. List Admin Sessions

`GET /api/admin/ai-interviews`

Supported query params:

- `type`
- `status`
- `search`
- `from`
- `to`

Behavior:

- `search` is matched against candidate name, email, track title,
  specialization, and target role.
- `from` and `to` filter by `createdAt`.

Returns:

- `Session[]`

Aliased root key:

- `sessions`

### 12. Get Admin Session Report

`GET /api/admin/ai-interviews/:sessionId`

Returns:

```json
{
  "session": {},
  "track": {},
  "adminNote": "Optional reviewer note"
}
```

Notes:

- `session` includes `result`, `focusLossEvents`, and `focusLossAssessment`.

### 13. Schedule Interview

`POST /api/admin/ai-interviews/schedule`

Request:

```json
{
  "candidateName": "Jane Doe",
  "candidateEmail": "jane@example.com",
  "trackId": "generalist-foundation",
  "languageCode": "en-US",
  "targetRole": "Generalist Annotator",
  "resumeName": "jane_cv.pdf"
}
```

Behavior:

- Resolves the candidate from `DTUser` using `candidateEmail`.
- Resolves resume context from the candidate profile.
- Creates a scheduled session for the selected track.
- If an unfinished session already exists for the same candidate and track, that
  session is returned with `200` instead of creating another one.

Returns:

- `Session`

Aliased root key:

- `session`

### 14. Update Admin Decision

`PATCH /api/admin/ai-interviews/:sessionId/decision`

Request:

```json
{
  "sessionId": "optional",
  "status": "retry-required"
}
```

Allowed `status` values:

- `passed`
- `retry-required`
- `action-required`

Behavior:

- Updates the final decision.
- Rebuilds final decision labels and next-step messaging.
- Can be used after an automatic focus-loss failure if admin needs to override.

Returns:

- `Session`

Aliased root key:

- `session`

### 15. Update Admin Note

`PATCH /api/admin/ai-interviews/:sessionId/note`

Request:

```json
{
  "note": "Reviewer note"
}
```

Returns:

```json
{
  "success": true
}
```

## Common Error Responses

### Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["\"trackId\" is required"]
}
```

### Not Found

```json
{
  "success": false,
  "message": "Interview session not found"
}
```

Possible not-found messages:

- `User not found`
- `Admin user not found`
- `Candidate not found in DTUser records`
- `Interview track not found`
- `Interview session not found`
- `Resume asset not found`

### Conflict

```json
{
  "success": false,
  "message": "This interview session has already been completed"
}
```

## AI and Integrity Notes

### Resume Parsing

- Candidate resume context is sourced from the DTUser profile or uploaded resume
  asset.
- Parsed resume data is used to personalize questions and improve scoring.

### AI Roles

The backend uses separate AI stages for:

- question personalization
- answer scoring
- final report generation
- focus-loss integrity classification

### Focus-Loss Policy

- Supported types are `tab-hidden` and `window-blur`.
- Any recorded focus-loss event triggers immediate automatic failure.
- The downgrade is returned in the same `Session` payload.
- The previous score and status are retained inside
  `focusLossAssessment.previousScore` and `focusLossAssessment.previousStatus`.

## Current Track IDs

Current built-in track IDs:

- `generalist-foundation`
- `project-python-logic`

The frontend should still rely on `GET /api/ai-interviews/tracks` as the source
of truth.
