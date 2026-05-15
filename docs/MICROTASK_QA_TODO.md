# Microtask QA Todo

## Completed Admin Build

- Added a dedicated reviewed-submissions admin endpoint per task using active `TaskApplication` records.
- Added admin status filtering for:
  - `approved`
  - `rejected`
  - `partially_rejected`
  - `under_review`
- Added admin override support for reviewed submissions.
- Added dataset export per task for:
  - `approved`
  - `rejected`
  - `partially_rejected`
- Export output now includes:
  - a zip file of images downloaded from stored file URLs
  - `metadata.csv`
  - `task-summary.json`
  - `download-errors.json` when any image download fails
- Export delivery now streams the zip to the client instead of buffering the full archive in memory first.
- Export rows are generated from `task_image_upload.metadata` plus participant `DTUser` profile fields.
- Exported submissions are now marked with `exportAudit` metadata:
  - `exportedBy`
  - `exportedAt`
  - `exportType`
  - `exportFileName`
- Task-level submission counts for detail and statistics now use active `TaskApplication` data instead of the legacy submission model.

## Remaining Tests

- Add automated tests for:
  - participant completion to QA queue handoff
  - QA image review
  - QA submission approval and rejection
  - admin override flow
  - export payload generation

## Remaining Cleanup

- Unify the old and new microtask backend stacks so the repo only has one submission flow.
- Decide whether to retire the legacy `/api/micro-task-submissions` path completely.
- Tighten access on older endpoints that still expose cross-user task application data more broadly than needed.
