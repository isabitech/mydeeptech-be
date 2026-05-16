# Microtask QA Handoff

## What Changed

- The active participant submission flow now hands completed microtask work into the QA queue by setting `TaskApplication.status = "under_review"` when all required images have been uploaded.
- Approved QA users can now access the QA module based on `DTUser.qaStatus === "approved"`. Admin and super admin users also keep access.
- The QA module now reads from the same models the participant flow already uses:
  - `Task` for admin-created microtasks
  - `TaskApplication` for each participant submission
  - `task_image_upload` for the uploaded files and image metadata

## Source Of Truth

- Participant upload route: `POST /api/micro-tasks/upload`
- QA queue routes: `GET/POST /api/micro-task-qa/...`
- Admin reviewed/export routes: `GET/POST /api/micro-tasks/:taskId/...`
- Submission id for QA: the `submissionId` returned by the upload flow is the `TaskApplication._id`

## QA Access Rule

- Allowed:
  - `admin`
  - `super_admin`
  - any `DTUser` with `qaStatus === "approved"`
- The backend no longer depends on legacy uppercase role checks for the QA module.

## Submission Lifecycle

1. Admin creates a microtask in the existing `Task` flow.
2. Annotator or microtasker uploads images through `POST /api/micro-tasks/upload`.
3. When the submission is complete, the backend sets:
   - `TaskApplication.status = "under_review"`
   - `TaskApplication.submittedAt = new Date()`
4. QA opens `GET /api/micro-task-qa/queue`.
5. QA reviews images one by one and completes the submission with an overall decision.
6. Final QA statuses on `TaskApplication` are:
   - `approved`
   - `rejected`
   - `partially_rejected` if needed

## Frontend Endpoints

### QA Queue

- `GET /api/micro-task-qa/queue`
- Optional query:
  - `page`
  - `limit`
  - `taskId`
  - `category`
  - `priority=oldest_first|newest_first`

### QA Queue Summary

- `GET /api/micro-task-qa/queue/summary`

### QA Submission Detail

- `GET /api/micro-task-qa/submissions/:submissionId`

Response highlights:
- `task`
- `applicant`
- `images`
- `imageStats`
- `progress`
- `allImagesReviewed`

### Review Single Image

- `POST /api/micro-task-qa/images/:imageId/review`

Body:

```json
{
  "status": "approved",
  "rejection_reason": "",
  "quality_notes": ""
}
```

Allowed `status` values:
- `approved`
- `rejected`
- `needs_replacement`

### Complete Submission Review

- `POST /api/micro-task-qa/submissions/:submissionId/complete`

Body:

```json
{
  "status": "approved",
  "quality_score": 90,
  "review_notes": "Looks good."
}
```

Allowed `status` values:
- `approved`
- `rejected`
- `partially_rejected`

### Bulk Approve

- `POST /api/micro-task-qa/submissions/bulk-approve`

Body:

```json
{
  "submissionIds": ["<taskApplicationId>"]
}
```

### Reviewer History

- `GET /api/micro-task-qa/my-reviews`

## Admin Endpoints

### Reviewed Submissions By Task

- `GET /api/micro-tasks/:taskId/reviewed-submissions`

Optional query:
- `page`
- `limit`
- `status=all|under_review|approved|rejected|partially_rejected`
- `search` by applicant name, email, phone, or user id
- `sort=recently_reviewed|oldest_reviewed|newest_submitted|oldest_submitted`

Response highlights:
- `task`
- `submissions`
- `statusCounts`
- `availableStatuses`
- `pagination`

### Admin Override

- `POST /api/micro-tasks/:taskId/reviewed-submissions/:submissionId/override`

Body:

```json
{
  "status": "approved",
  "quality_score": 95,
  "review_notes": "Admin override after manual spot-check.",
  "sync_images": true
}
```

Notes:
- Allowed `status` values:
  - `approved`
  - `rejected`
  - `partially_rejected`
- `sync_images` defaults to:
  - `true` for `approved`
  - `true` for `rejected`
  - `false` for `partially_rejected`
- If admin overrides to `approved` or `rejected`, the backend can sync all image-level statuses to match the new submission decision.

### Dataset Export

- `GET /api/micro-tasks/:taskId/export-dataset?status=approved`

Allowed `status` values:
- `approved`
- `rejected`
- `partially_rejected`

Response:
- file download
- content type: `application/zip`
- response is streamed directly from the backend
- response header `X-Export-Mode` is `stream`
- `Content-Length` may be omitted because the zip is not buffered fully in memory first

Zip contents:
- `metadata.csv`
- `task-summary.json`
- `download-errors.json` only when one or more image downloads fail during export
- `images/...` folders containing the downloaded Cloudinary files

Notes:
- final `downloadedImages` and `failedImages` counts are written into `task-summary.json`
- the backend records export audit metadata only after the stream completes successfully
- image files are downloaded one at a time through temporary storage before being added to the zip, so large files do not need to sit fully in server memory

Export audit:
- each exported `TaskApplication` gets an `exportAudit` entry with:
  - `exportedBy`
  - `exportedAt`
  - `exportType`
  - `exportFileName`

### Single Submission Dataset Export

- `GET /api/micro-tasks/:taskId/reviewed-submissions/:submissionId/export-dataset`

Purpose:
- exports exactly one reviewed submission at a time
- safer fallback for very large tasks or when retrying a single participant package

Rules:
- the submission must belong to the task in the route
- the submission's current status must already be one of:
  - `approved`
  - `rejected`
  - `partially_rejected`

Response:
- same streamed zip structure as the task-level dataset export
- response header `X-Exported-Submission-Id` contains the exported `TaskApplication._id`
- `X-Exported-Submission-Count` will be `1`

### Export CSV Columns

- `Angle`
- `Task Category`
- `Image Sequence`
- `Upload Timestamp`
- `File Size`
- `Resolution`
- `File URL`
- `Full Name`
- `User ID`
- `Country of Residence`
- `Country of Origin`
- `Age`
- `Gender`
- `Recruiter Name`
- `Contact Email (internal only)`
- `Contact Phone (internal only)`
- `Submission Status`
- `Image Status`
- `Submission ID`
- `Image ID`

## Admin View Right Now

- Admin can still use the QA routes because admin access is allowed.
- For the admin microtask review screen, use the dedicated task-level admin endpoints above instead of building on the older `/api/micro-tasks/filters` list.
- Task detail and statistics endpoints now read submission counts from active `TaskApplication` records instead of the legacy submission model.

## Important Note

- For new frontend work, treat `TaskApplication` as the active microtask submission record.
- Do not build new screens against the legacy `/api/micro-task-submissions` flow. It is not the active participant submission path in the current backend.
