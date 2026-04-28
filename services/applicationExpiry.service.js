const ProjectApplication = require("../models/projectApplication.model");
const MailService = require("./mail-service/mail-service");

class ApplicationExpiryService {
  constructor() {
    this.mailService = new MailService();
  }

  /**
   * Find and auto-reject expired applications
   * This method should be called by a scheduled job/cron
   */
  async processExpiredApplications() {
    try {
      console.log("🕐 Processing expired applications...");
      
      const currentDate = new Date();
      
      // Find all applications that are past their expiry date and still
      // eligible for review or interview completion.
      const expiredApplications = await ProjectApplication.find({
        expiryDate: { $lt: currentDate },
        status: { $in: ["pending", "assessment_required", "ai_interview_required"] }
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

      console.log(`📋 Found ${expiredApplications.length} expired applications to process`);

      const processedApplications = [];
      const errors = [];

      for (const application of expiredApplications) {
        try {
          // Update application status to rejected with expiry reason
          await ProjectApplication.findByIdAndUpdate(application._id, {
            status: "rejected",
            rejectionReason: "expired",
            reviewedAt: currentDate,
            reviewNotes: `Application automatically rejected due to expiry on ${currentDate.toISOString()}`,
            applicantNotified: false // Will be set to true after email is sent
          });

          // Send expiry notification email to applicant
          if (application.applicantId?.email) {
            try {
              await this.sendExpiryNotificationEmail(
                application.applicantId.email,
                application.applicantId.fullName,
                application.projectId.projectName,
                application.expiryDate
              );

              // Mark as notified
              await ProjectApplication.findByIdAndUpdate(application._id, {
                applicantNotified: true
              });

              console.log(`📧 Expiry notification sent to ${application.applicantId.email} for project "${application.projectId.projectName}"`);
            } catch (emailError) {
              console.error(`❌ Failed to send expiry email to ${application.applicantId.email}:`, emailError);
              errors.push({
                applicationId: application._id,
                error: "Failed to send email notification",
                details: emailError.message
              });
            }
          }

          processedApplications.push({
            applicationId: application._id,
            applicantName: application.applicantId?.fullName,
            projectName: application.projectId?.projectName,
            expiryDate: application.expiryDate
          });

        } catch (applicationError) {
          console.error(`❌ Failed to process expired application ${application._id}:`, applicationError);
          errors.push({
            applicationId: application._id,
            error: "Failed to update application",
            details: applicationError.message
          });
        }
      }

      const result = {
        processedCount: processedApplications.length,
        errorCount: errors.length,
        processedApplications,
        errors,
        processedAt: currentDate
      };

      console.log(`✅ Successfully processed ${processedApplications.length} expired applications`);
      if (errors.length > 0) {
        console.log(`⚠️  ${errors.length} errors occurred during processing`);
      }

      return result;

    } catch (error) {
      console.error("❌ Critical error in processExpiredApplications:", error);
      throw error;
    }
  }

  /**
   * Send expiry notification email to applicant
   */
  async sendExpiryNotificationEmail(email, fullName, projectName, expiryDate) {
    const emailSubject = `Application Expired: ${projectName}`;
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Application Expired</h2>
        
        <p>Dear ${fullName},</p>
        
        <p>We regret to inform you that your application for the project <strong>"${projectName}"</strong> has expired.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application Details:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Project: ${projectName}</li>
            <li>Expiry Date: ${expiryDate.toLocaleDateString()} at ${expiryDate.toLocaleTimeString()}</li>
            <li>Status: Automatically Rejected</li>
          </ul>
        </div>
        
        <p>Applications expire based on the project's application duration policy to ensure timely processing of all submissions.</p>
        
        <p><strong>What's Next?</strong></p>
        <ul>
          <li>You can apply to other available projects on our platform</li>
          <li>Check for new project opportunities that match your skills</li>
          <li>Ensure your profile is up-to-date for future applications</li>
        </ul>
        
        <p>Thank you for your interest in working with MyDeepTech. We encourage you to explore other opportunities on our platform.</p>
        
        <p>Best regards,<br>The MyDeepTech Team</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated notification. If you have any questions, please contact our support team.
        </p>
      </div>
    `;

    await this.mailService.sendHTMLEmail(email, emailSubject, emailContent);
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
        status: { $in: ["pending", "assessment_required", "ai_interview_required"] }
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
