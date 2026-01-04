import Notification from '../models/notification.model.js';
import mongoose from 'mongoose';

/**
 * Create a general notification
 * @param {Object} notificationData - Notification details
 * @returns {Object} Created notification
 */
const createNotification = async (notificationData) => {
  try {
    const { userId, type, title, message, data = {}, priority = 'medium' } = notificationData;
    // Determine user model type
    let userModel = 'User';
    if (mongoose.Types.ObjectId.isValid(userId)) {
      // Try to infer if it's a DTUser (optional: you can improve this logic)
      // For now, default to DTUser for all
      userModel = 'DTUser';
    }
    const notification = await Notification.create({
      userId,
      userModel,
      type,
      title,
      message,
      data,
      priority
    });
    console.log(`✅ Notification created in DB:`, notification);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

/**
 * Create application status notification
 * @param {String} userId - User ID who should receive notification
 * @param {String} status - Application status (approved, rejected, etc.)
 * @param {Object} project - Project details
 * @param {Object} application - Application details
 */
const createApplicationStatusNotification = async (userId, status, project, application) => {
  try {
    console.log(`📬 Creating application status notification for user ${userId}: ${status}`);

    const titles = {
      approved: `Application Approved: ${project.projectName}`,
      rejected: `Application Update: ${project.projectName}`,
      pending: `Application Received: ${project.projectName}`
    };

    const messages = {
      approved: `Congratulations! Your application for "${project.projectName}" has been approved. You can now start working on this project.`,
      rejected: `Your application for "${project.projectName}" has been reviewed. Please check your email for details.`,
      pending: `Your application for "${project.projectName}" has been received and is under review.`
    };

    const notification = await createNotification({
      userId: userId,
      type: 'application_status',
      title: titles[status] || `Application Update: ${project.projectName}`,
      message: messages[status] || `Your application status has been updated.`,
      data: {
        projectId: project._id,
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        applicationId: application._id,
        status: status
      }
    });

    return notification;

  } catch (error) {
    console.error('❌ Error creating application status notification:', error);
    throw error;
  }
};

/**
 * Create assessment completion notification
 * @param {String} userId - User ID who completed assessment
 * @param {Object} assessmentData - Assessment completion details
 */
const createAssessmentCompletionNotification = async (userId, assessmentData) => {
  try {
    console.log(`🎯 Creating assessment completion notification for user ${userId}`);

    const { totalScore, percentage, sections } = assessmentData;

    const notification = await createNotification({
      userId: userId,
      type: 'assessment_completed',
      title: 'Assessment Completed Successfully',
      message: `You have completed your assessment with a score of ${totalScore} points (${percentage}%). Your results are being reviewed.`,
      data: {
        totalScore: totalScore,
        percentage: percentage,
        sections: sections,
        completedAt: new Date()
      }
    });

    return notification;

  } catch (error) {
    console.error('❌ Error creating assessment completion notification:', error);
    throw error;
  }
};

/**
 * Create system announcement notification
 * @param {String} title - Announcement title
 * @param {String} message - Announcement message
 * @param {String} priority - Priority level (low, normal, high)
 * @param {String} targetUsers - Target user type (all, annotators, microtaskers)
 */
const createSystemAnnouncement = async (title, message, priority = 'normal', targetUsers = 'all') => {
  try {
    console.log(`📢 Creating system announcement: ${title}`);

    // For now, just log the announcement until notification model is implemented
    const announcement = {
      id: new Date().getTime(),
      type: 'system_announcement',
      title: title,
      message: message,
      priority: priority,
      targetUsers: targetUsers,
      createdAt: new Date(),
      status: 'active'
    };

    console.log(`✅ System announcement created:`, announcement);

    return announcement;

  } catch (error) {
    console.error('❌ Error creating system announcement:', error);
    throw error;
  }
};

export {
  createNotification,
  createApplicationStatusNotification,
  createAssessmentCompletionNotification,
  createSystemAnnouncement
};
