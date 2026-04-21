const MultimediaAssessmentSessionRepository = require("../repositories/multimediaAssessmentSession.repository");
const MultimediaAssessmentConfigRepository = require("../repositories/multimediaAssessmentConfig.repository");
const VideoReel = require("../models/videoReel.model");
const DTUser = require("../models/dtUser.model");
const ProjectApplication = require("../models/projectApplication.model");
const AnnotationProject = require("../models/annotationProject.model");
const MailService = require("../services/mail-service/mail-service");

class MultimediaAssessmentSessionService {
  getInProgressSessionFilter(submissionId, userId) {
    return {
      _id: submissionId,
      annotatorId: userId,
      status: "in_progress",
    };
  }

  getReadableSessionFilter(submissionId, userId) {
    return {
      _id: submissionId,
      annotatorId: userId,
    };
  }

  getTaskByNumber(submission, taskNumber) {
    return submission.tasks.find((task) => task.taskNumber === taskNumber);
  }

  getConversationDuration(turns = []) {
    return turns.reduce((sum, turn) => {
      const segment = turn.aiResponse?.videoSegment;
      if (!segment) {
        return sum;
      }

      return sum + (segment.endTime - segment.startTime);
    }, 0);
  }

  buildTaskConversation(conversation) {
    return {
      originalVideoId: conversation.originalVideoId,
      startingPoint: conversation.startingPoint,
      turns: (conversation.turns || []).map((turn) => ({
        ...turn,
        aiResponse: {
          ...turn.aiResponse,
          videoSegment: {
            ...turn.aiResponse.videoSegment,
            role: "ai_response",
          },
        },
      })),
      totalDuration: this.getConversationDuration(conversation.turns),
    };
  }

  async loadSessionForUser(submissionId, userId, status = "in_progress") {
    const filter = {
      _id: submissionId,
      annotatorId: userId,
    };

    if (status) {
      filter.status = status;
    }

    return MultimediaAssessmentSessionRepository.findOne(filter);
  }

  async startAssessmentSession(assessmentId, userId, sessionMetadata, reqIp) {
    const [assessmentConfig, retakeEligibility, latestAttempt] =
      await Promise.all([
        MultimediaAssessmentConfigRepository.findById(assessmentId),
        MultimediaAssessmentSessionRepository.canUserRetake(
          userId,
          assessmentId,
        ),
        MultimediaAssessmentSessionRepository.findLatestUserAttempt(
          userId,
          assessmentId,
        ),
      ]);

    if (!assessmentConfig || !assessmentConfig.isActive) {
      throw {
        status: 404,
        message: "Assessment configuration not found or inactive",
      };
    }

    if (!retakeEligibility.canRetake) {
      throw {
        status: 400,
        message: `Cannot start assessment: ${retakeEligibility.reason}`,
        retakeInfo: retakeEligibility,
      };
    }

    const attemptNumber = latestAttempt ? latestAttempt.attemptNumber + 1 : 1;

    const availableReels = await VideoReel.getAssessmentReels(assessmentConfig);
    if (
      availableReels.length < assessmentConfig.requirements.tasksPerAssessment
    ) {
      throw {
        status: 500,
        message: "Insufficient video reels available for assessment",
        required: assessmentConfig.requirements.tasksPerAssessment,
        available: availableReels.length,
      };
    }

    const selectedReels = availableReels
      .sort(() => 0.5 - Math.random())
      .slice(0, assessmentConfig.requirements.tasksPerAssessment);

    const submissionData = {
      assessmentId,
      annotatorId: userId,
      projectId: assessmentConfig.projectId._id,
      attemptNumber,
      previousAttempt: latestAttempt?._id || null,
      sessionMetadata: {
        browserInfo: sessionMetadata.browserInfo || "",
        ipAddress: reqIp || "",
        deviceType: sessionMetadata.deviceType || "unknown",
        screenResolution: sessionMetadata.screenResolution || "",
      },
      timerState: {
        isRunning: true,
        startTime: new Date(),
        pausedTime: 0,
        totalPausedDuration: 0,
        lastPauseStart: null,
      },
      tasks: selectedReels.map((reel, index) => ({
        taskNumber: index + 1,
        conversation: {
          originalVideoId: reel._id,
          turns: [],
          totalDuration: 0,
          startingPoint: "prompt",
        },
        timeSpent: 0,
        isCompleted: false,
      })),
    };

    const submission =
      await MultimediaAssessmentSessionRepository.create(submissionData);

    const user = await DTUser.findById(userId);
    const shouldUpdateUser =
      user && user.multimediaAssessmentStatus === "not_started";

    assessmentConfig.statistics.totalAttempts += 1;

    const pendingWrites = [assessmentConfig.save()];
    if (shouldUpdateUser) {
      user.multimediaAssessmentStatus = "in_progress";
      pendingWrites.push(user.save());
    }

    await Promise.all(pendingWrites);

    return { submission, assessmentConfig, selectedReels };
  }

  async getAssessmentSession(submissionId, userId) {
    const submission = await this.loadSessionForUser(
      submissionId,
      userId,
      false,
    );
    if (!submission)
      throw {
        status: 404,
        message: "Assessment session not found or access denied",
      };

    await submission.populate([
      "assessmentId",
      { path: "projectId", select: "projectName" },
      "tasks.conversation.originalVideoId",
    ]);

    return submission;
  }

  async saveTaskProgress(submissionId, userId, taskNumber, conversation) {
    const submission = await this.loadSessionForUser(submissionId, userId);
    if (!submission)
      throw {
        status: 404,
        message: "Assessment session not found, completed, or access denied",
      };

    const task = this.getTaskByNumber(submission, taskNumber);
    if (!task) throw { status: 404, message: `Task ${taskNumber} not found` };

    task.conversation = this.buildTaskConversation(conversation);

    const taskTimeSpent = Math.floor(
      (Date.now() - submission.updatedAt.getTime()) / 1000,
    );
    task.timeSpent += taskTimeSpent;

    await submission.save();
    return { task, submission };
  }

  async submitTask(submissionId, userId, taskNumber) {
    const submission = await this.loadSessionForUser(submissionId, userId);
    if (!submission)
      throw {
        status: 404,
        message: "Assessment session not found, completed, or access denied",
      };

    const parsedTaskNumber = parseInt(taskNumber, 10);
    const task = this.getTaskByNumber(submission, parsedTaskNumber);
    if (!task) throw { status: 404, message: `Task ${taskNumber} not found` };
    if (task.isCompleted)
      throw { status: 400, message: "Task already completed" };

    if (!task.conversation.turns || task.conversation.turns.length < 3) {
      throw {
        status: 400,
        message: "Task must have at least 3 conversation turns to submit",
      };
    }

    await submission.completeTask(parsedTaskNumber);
    return { task, submission };
  }

  async controlTimer(submissionId, userId, action) {
    const submission = await this.loadSessionForUser(submissionId, userId);
    if (!submission)
      throw {
        status: 404,
        message: "Assessment session not found, completed, or access denied",
      };

    await submission.populate("assessmentId");

    if (
      (action === "pause" || action === "resume") &&
      !submission.assessmentId.requirements.allowPausing
    ) {
      throw {
        status: 400,
        message: "Timer pausing is not allowed for this assessment",
      };
    }

    let updatedSubmission;
    switch (action) {
      case "start":
        updatedSubmission = await submission.startTimer();
        break;
      case "pause":
        updatedSubmission = await submission.pauseTimer();
        break;
      case "resume":
        updatedSubmission = await submission.resumeTimer();
        break;
    }

    return updatedSubmission;
  }

  async submitAssessment(submissionId, userId) {
    const submission = await this.loadSessionForUser(submissionId, userId);
    if (!submission)
      throw {
        status: 404,
        message: "Assessment session not found, completed, or access denied",
      };

    await submission.populate([
      "assessmentId",
      { path: "annotatorId", select: "fullName email" },
      { path: "projectId", select: "projectName" },
    ]);

    const incompleteTasks = submission.tasks.filter(
      (task) => !task.isCompleted,
    );
    if (incompleteTasks.length > 0) {
      throw {
        status: 400,
        message: "All tasks must be completed before submitting assessment",
        incompleteTasks: incompleteTasks.map((t) => t.taskNumber),
      };
    }

    if (submission.timerState.isRunning) {
      await submission.pauseTimer();
    }

    submission.status = "submitted";
    submission.submittedAt = new Date();

    const user = await DTUser.findById(userId);
    if (user) {
      user.multimediaAssessmentStatus = "under_review";
    }

    const pendingWrites = [submission.save()];
    if (user) {
      pendingWrites.push(user.save());
    }

    await Promise.all(pendingWrites);

    submission.assessmentId.statistics.totalCompletions += 1;
    await submission.assessmentId.save();

    try {
      await MailService.sendAssessmentCompletionEmail(
        submission.annotatorId.email,
        submission.annotatorId.fullName,
        {
          assessmentTitle: submission.assessmentId.title,
          projectName: submission.projectId.projectName,
          submissionId: submission._id,
          completedTasks: submission.tasks.length,
          totalTimeSpent: submission.formattedTimeSpent,
          submittedAt: submission.submittedAt,
        },
      );
    } catch (emailError) {
      console.error("❌ Failed to send completion email:", emailError);
    }

    try {
      await this.handleAssessmentCompletion(
        userId,
        submission.assessmentId._id,
        submission._id,
      );
    } catch (applicationError) {
      console.error(
        "❌ Failed to update project applications:",
        applicationError,
      );
    }

    return submission;
  }

  async handleAssessmentCompletion(userId, assessmentId, submissionId) {
    const assessmentPromise =
      MultimediaAssessmentConfigRepository.findById(assessmentId);
    const userPromise = DTUser.findById(userId, "fullName email attachments");

    const assessmentConfig = await assessmentPromise;

    if (assessmentConfig && assessmentConfig.projectId) {
      const applicationsPromise = ProjectApplication.find({
        projectId: assessmentConfig.projectId._id,
        applicantId: userId,
        status: "assessment_required",
      });
      const applications = await applicationsPromise;

      if (applications.length > 0) {
        const [project, user] = await Promise.all([
          AnnotationProject.findById(assessmentConfig.projectId._id)
            .populate("createdBy", "fullName email")
            .populate("assignedAdmins", "fullName email"),
          userPromise,
        ]);

        await ProjectApplication.updateMany(
          {
            projectId: assessmentConfig.projectId._id,
            applicantId: userId,
            status: "assessment_required",
          },
          {
            status: "pending",
            assessmentCompletedAt: new Date(),
            assessmentSubmissionId: submissionId,
          },
        );

        console.log(
          `✅ Updated ${applications.length} project applications to pending status for user ${userId}`,
        );

        try {
          if (project && user) {
            const applicationData = {
              applicantName: user.fullName,
              applicantEmail: user.email,
              resumeUrl: user.attachments?.resume_url || "",
              projectName: project.projectName,
              projectCategory: project.projectCategory,
              payRate: project.payRate,
              coverLetter: "Assessment completed - ready for review",
              appliedAt: new Date(),
              assessmentCompleted: true,
            };

            if (project.createdBy) {
              await MailService.sendProjectApplicationNotification(
                project.createdBy.email,
                project.createdBy.fullName,
                applicationData,
              );
            }

            for (const admin of project.assignedAdmins) {
              if (admin._id.toString() !== project.createdBy._id.toString()) {
                await MailService.sendProjectApplicationNotification(
                  admin.email,
                  admin.fullName,
                  applicationData,
                );
              }
            }
          }
        } catch (notificationError) {
          console.error(
            "Failed to send admin notifications after assessment completion:",
            notificationError,
          );
        }
      }
    }
  }

  async getAvailableReels(assessmentId, niche, limit, userId) {
    const [assessmentConfig, userSubmissions] = await Promise.all([
      MultimediaAssessmentConfigRepository.findById(assessmentId),
      MultimediaAssessmentSessionRepository.find({
        annotatorId: userId,
        assessmentId,
      }),
    ]);

    if (!assessmentConfig || !assessmentConfig.isActive) {
      throw {
        status: 404,
        message: "Assessment configuration not found or inactive",
      };
    }

    const query = { isActive: true, isApproved: true };
    if (niche) query.niche = niche;

    const usedReelIds = userSubmissions
      .flatMap((submission) =>
        submission.tasks.map((task) => task.conversation?.originalVideoId),
      )
      .filter(Boolean);

    if (usedReelIds.length > 0) {
      query._id = { $nin: usedReelIds };
    }

    const availableReels = await VideoReel.find(query)
      .limit(parseInt(limit))
      .sort({ usageCount: 1, createdAt: -1 });

    return {
      availableReels,
      totalAvailable: availableReels.length,
      usedReelsCount: usedReelIds.length,
    };
  }
}

module.exports = new MultimediaAssessmentSessionService();
