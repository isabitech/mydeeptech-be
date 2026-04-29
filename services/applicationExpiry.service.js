const ProjectApplication = require("../models/projectApplication.model");
const AnnotationProject = require("../models/annotationProject.model");
const DTUser = require("../models/dtUser.model"); // Required for applicantId populate
const MailService = require("./mail-service/mail-service");

class ApplicationExpiryService {
  constructor() {
    // MailService uses static methods, no need to instantiate
  }

  /**
   * Find and auto-reject expired applications
   * This method should be called by a scheduled job/cron
   * @param {Object} options - Processing options
   * @param {number} options.batchSize - Number of applications to process per batch (default: 20)
   * @param {number} options.delayBetweenBatches - Delay in ms between email batches (default: 5000)
   * @param {number} options.emailBatchSize - Number of emails to send per batch (default: 10)
   */
  async processExpiredApplications(options = {}) {
    const {
      batchSize = 20,
      delayBetweenBatches = 5000, // 5 seconds
      emailBatchSize = 10
    } = options;

    try {
      const currentDate = new Date();
 
      // Find all applications that are past their expiry date and still pending/assessment_required
      const expiredApplications = await ProjectApplication.find({
        expiryDate: { $lt: currentDate },
        status: { $in: ["pending", "assessment_required"] }
      }).populate([
        {
          path: "applicantId",
          select: "fullName email"
        },
        {
          path: "projectId",
          select: "projectName"
        }
      ]);

      if (expiredApplications.length === 0) {
        console.log("✅ No expired applications found - process complete");
        return { 
          processedCount: 0, 
          errorCount: 0, 
          processedApplications: [], 
          errors: [], 
          processedAt: currentDate 
        };
      }

      console.log(`📊 Found ${expiredApplications.length} expired applications`);
      console.log(`⚙️  Processing in batches of ${batchSize} with email batches of ${emailBatchSize}`);

      const processedApplications = [];
      const errors = [];
      const emailQueue = [];

      // Process applications in batches
      for (let i = 0; i < expiredApplications.length; i += batchSize) {
        const batch = expiredApplications.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(expiredApplications.length / batchSize);

        console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} applications)`);

        // Process database updates for this batch
        for (const application of batch) {
          try {
            // Update application status to rejected with expiry reason
            await ProjectApplication.findByIdAndUpdate(application._id, {
              status: "rejected",
              rejectionReason: "expired",
              reviewedAt: currentDate,
              reviewNotes: `Application automatically rejected due to expiry on ${currentDate.toISOString()}`,
              applicantNotified: false // Will be set to true after email is sent
            });

            // Add to email queue instead of sending immediately
            if (application.applicantId?.email) {
              emailQueue.push({
                applicationId: application._id,
                email: application.applicantId.email,
                fullName: application.applicantId.fullName,
                projectName: application.projectId.projectName,
                expiryDate: application.expiryDate
              });
            }

            processedApplications.push({
              applicationId: application._id,
              applicantName: application.applicantId?.fullName,
              projectName: application.projectId?.projectName,
              expiryDate: application.expiryDate
            });

          } catch (applicationError) {
            console.error(`❌ Failed processing application ${application._id}:`, applicationError);
            errors.push({
              applicationId: application._id,
              error: "Failed to update application",
              details: applicationError.message
            });
          }
        }
        console.log(`✅ Batch ${batchNumber} database updates complete`);
      }
      // Process email queue in batches with delays
      console.log(`📧 Processing ${emailQueue.length} emails in batches of ${emailBatchSize}`);
      await this.processEmailQueue(emailQueue, {
        emailBatchSize,
        delayBetweenBatches,
        errors
      });

      const result = {
        processedCount: processedApplications.length,
        errorCount: errors.length,
        processedApplications,
        errors,
        processedAt: currentDate,
        batchingStats: {
          totalApplications: expiredApplications.length,
          applicationBatchSize: batchSize,
          emailBatchSize: emailBatchSize,
          totalEmailsSent: emailQueue.length - errors.filter(e => e.error.includes('email')).length
        }
      };

      if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors occurred during processing`);
      } else {
        console.log(`🎉 All ${expiredApplications.length} applications processed successfully!`);
      }

      return result;

    } catch (error) {
      console.error("❌ Critical error in processExpiredApplications:", error);
      throw error;
    }
  }

  /**
   * Process email queue in batches with proper delays and error handling
   */
  async processEmailQueue(emailQueue, options = {}) {
    const { emailBatchSize, delayBetweenBatches, errors } = options;
    
    for (let i = 0; i < emailQueue.length; i += emailBatchSize) {
      const emailBatch = emailQueue.slice(i, i + emailBatchSize);
      const batchNumber = Math.floor(i / emailBatchSize) + 1;
      const totalEmailBatches = Math.ceil(emailQueue.length / emailBatchSize);
      
      console.log(`📧 Sending email batch ${batchNumber}/${totalEmailBatches} (${emailBatch.length} emails)`);

      // Send emails in parallel within the batch
      const emailPromises = emailBatch.map(async (emailData) => {
        try {
          await this.sendExpiryNotificationEmail(
            emailData.email,
            emailData.fullName,
            emailData.projectName,
            emailData.expiryDate
          );

          // Mark as notified on success
          await ProjectApplication.findByIdAndUpdate(emailData.applicationId, {
            applicantNotified: true
          });

          return { success: true, applicationId: emailData.applicationId };
        } catch (emailError) {
          console.error(`❌ Email failed for ${emailData.email}:`, emailError);
          errors.push({
            applicationId: emailData.applicationId,
            error: "Failed to send email notification",
            details: emailError.message,
            email: emailData.email
          });
          return { success: false, applicationId: emailData.applicationId };
        }
      });

      // Wait for all emails in this batch to complete
      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = emailBatch.length - successful;
      
      console.log(`📧 Email batch ${batchNumber} complete: ${successful} sent, ${failed} failed`);

      // Add delay between batches (except for the last batch)
      if (i + emailBatchSize < emailQueue.length) {
        console.log(`⏰ Waiting ${delayBetweenBatches}ms before next email batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
  }

  /**
   * Send expiry notification email to applicant
   */
  async sendExpiryNotificationEmail(email, fullName, projectName, expiryDate) {
    try {
      // Create a more specific email for expiry notifications to avoid spam filters
      const subject = `Application Status Update - ${projectName}`;
      
      const projectData = {
        projectName: projectName,
        projectCategory: "Project Application", // Generic to avoid issues
        adminName: "MyDeepTech Team",
        rejectionReason: "application_period_expired",
        reviewNotes: `Your application for "${projectName}" has been automatically closed due to the application period ending on ${expiryDate.toLocaleDateString()}. The application deadline for this project has passed. Please feel free to apply to other available projects on our platform.`
      };

      await MailService.sendProjectRejectionNotification(email, fullName, projectData);

    } catch (error) {
      console.error(`❌ Failed to send expiry notification to ${email}:`, error);
      throw error; // Re-throw to be caught by the calling code
    }
  }

  /**
   * Get statistics about expired applications
   */
  async getExpiryStatistics(days = 30) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const stats = await ProjectApplication.aggregate([
        {
          $match: {
            reviewedAt: { $gte: dateFrom },
            rejectionReason: "expired"
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$reviewedAt" },
              month: { $month: "$reviewedAt" },
              day: { $dayOfMonth: "$reviewedAt" }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
        }
      ]);

      const totalExpired = await ProjectApplication.countDocuments({
        rejectionReason: "expired",
        reviewedAt: { $gte: dateFrom }
      });

      return {
        totalExpiredLastNDays: totalExpired,
        dailyBreakdown: stats,
        period: `${days} days`,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error("❌ Error generating expiry statistics:", error);
      throw error;
    }
  }

  /**
   * Preview applications that will expire soon (for monitoring/alerts)
   */
  async getApplicationsExpiringSoon(hours = 24) {
    try {
      const alertDate = new Date();
      alertDate.setHours(alertDate.getHours() + hours);

      const expiringSoon = await ProjectApplication.find({
        expiryDate: {
          $lt: alertDate,
          $gt: new Date()
        },
        status: { $in: ["pending", "assessment_required"] }
      }).populate([
        {
          path: "applicantId",
          select: "fullName email"
        },
        {
          path: "projectId", 
          select: "projectName"
        }
      ]);

      return {
        count: expiringSoon.length,
        applications: expiringSoon.map(app => ({
          applicationId: app._id,
          applicantName: app.applicantId?.fullName,
          applicantEmail: app.applicantId?.email,
          projectName: app.projectId?.projectName,
          expiryDate: app.expiryDate,
          hoursUntilExpiry: Math.ceil((app.expiryDate - new Date()) / (60 * 60 * 1000))
        })),
        alertThreshold: `${hours} hours`,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error("❌ Error getting applications expiring soon:", error);
      throw error;
    }
  }
}

module.exports = ApplicationExpiryService;