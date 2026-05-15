const FINAL_TASK_APPLICATION_STATUSES = [
  "approved",
  "rejected",
  "partially_rejected",
  "under_review",
  "completed",
  "cancelled",
];

const PENDING_BUCKET_STATUSES = [
  "pending",
  "ongoing",
  "processing",
  "active",
];

function getRawTaskApplicationStatus(application = {}) {
  return application?.status || "pending";
}

function getTaskApplicationBucketStatus(application = {}) {
  const rawStatus = getRawTaskApplicationStatus(application);

  if (
    application?.isComplete !== true &&
    !FINAL_TASK_APPLICATION_STATUSES.includes(rawStatus)
  ) {
    return "pending";
  }

  if (PENDING_BUCKET_STATUSES.includes(rawStatus)) {
    return "pending";
  }

  return rawStatus;
}

function getPendingTaskApplicationMatch() {
  return {
    isComplete: { $ne: true },
    status: { $nin: FINAL_TASK_APPLICATION_STATUSES },
  };
}

module.exports = {
  FINAL_TASK_APPLICATION_STATUSES,
  PENDING_BUCKET_STATUSES,
  getRawTaskApplicationStatus,
  getTaskApplicationBucketStatus,
  getPendingTaskApplicationMatch,
};
