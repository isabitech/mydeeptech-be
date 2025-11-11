const { sendProjectEmail } = require('./brevoSMTP');

// Send project deletion OTP to Projects Officer
const sendProjectDeletionOTP = async (projectsOfficerEmail, deletionData) => {
  const {
    projectName,
    projectId,
    projectCategory,
    requestedBy,
    requestedByEmail,
    activeApplications,
    totalApplications,
    otp,
    expiryTime,
    reason
  } = deletionData;

  const subject = `🚨 PROJECT DELETION AUTHORIZATION REQUIRED - ${projectName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Deletion Authorization - MyDeeptech</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .otp-box { 
            background: #fff; 
            border: 2px solid #e74c3c; 
            border-radius: 10px; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0; 
          }
          .otp-code { 
            font-size: 36px; 
            font-weight: bold; 
            color: #e74c3c; 
            letter-spacing: 5px; 
            font-family: 'Courier New', monospace;
          }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .details { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { background: #2c3e50; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; }
        </style>
    </head>
    <body>
        <div class="container">
          <div class="header">
            <h1>🚨 PROJECT DELETION AUTHORIZATION</h1>
            <p>Critical Action Requires Your Approval</p>
          </div>
          
          <div class="content">
            <div class="warning">
              <strong>⚠️ URGENT AUTHORIZATION REQUIRED</strong><br>
              An administrator has requested to delete a project with active applications. 
              This action requires your explicit approval as Projects Officer.
            </div>

            <div class="details">
              <h3>📋 Project Deletion Request Details</h3>
              <p><strong>Project Name:</strong> ${projectName}</p>
              <p><strong>Project ID:</strong> ${projectId}</p>
              <p><strong>Category:</strong> ${projectCategory}</p>
              <p><strong>Total Applications:</strong> ${totalApplications}</p>
              <p><strong>Active Applications:</strong> <span style="color: #e74c3c; font-weight: bold;">${activeApplications}</span></p>
              <p><strong>Requested By:</strong> ${requestedBy} (${requestedByEmail})</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p><strong>Request Time:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div class="otp-box">
              <h3>🔐 Authorization Code</h3>
              <div class="otp-code">${otp}</div>
              <p><strong>Expires:</strong> ${expiryTime}</p>
              <p><em>Valid for 15 minutes only</em></p>
            </div>

            <div class="warning">
              <h4>⚠️ CRITICAL WARNING</h4>
              <p>Deleting this project will permanently remove:</p>
              <ul>
                <li><strong>${totalApplications} application(s)</strong> including ${activeApplications} active ones</li>
                <li>All project data and files</li>
                <li>All related records and history</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <h4>📝 How to Authorize:</h4>
            <ol>
              <li>Review the project deletion request carefully</li>
              <li>If you approve this deletion, provide the authorization code above to the requesting administrator</li>
              <li>The administrator will use this code to complete the deletion process</li>
              <li>If you do NOT approve, simply ignore this email (code will expire in 15 minutes)</li>
            </ol>

            <div class="details">
              <h4>🔍 Security Information</h4>
              <p><strong>OTP Code:</strong> ${otp}</p>
              <p><strong>Valid Until:</strong> ${expiryTime}</p>
              <p><strong>Requested From:</strong> Admin Panel</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>MyDeepTech Projects Officer Authorization System</strong></p>
            <p>This email was automatically generated for security purposes.</p>
            <p>Do not share this OTP code unless you approve the project deletion.</p>
          </div>
        </div>
    </body>
    </html>
  `;

  const textContent = `
🚨 PROJECT DELETION AUTHORIZATION REQUIRED

An administrator has requested to delete a project with active applications.

Project Details:
- Project: ${projectName} (ID: ${projectId})
- Category: ${projectCategory}
- Total Applications: ${totalApplications}
- Active Applications: ${activeApplications}
- Requested By: ${requestedBy} (${requestedByEmail})
- Reason: ${reason}

AUTHORIZATION CODE: ${otp}
Expires: ${expiryTime}

⚠️ WARNING: This will permanently delete ${totalApplications} applications including ${activeApplications} active ones.

To authorize: Provide the code above to the administrator.
To deny: Ignore this email (expires in 15 minutes).

MyDeepTech Projects Officer Authorization System
  `;

  try {
    await sendProjectEmail({
      to: projectsOfficerEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Project deletion OTP sent to: ${projectsOfficerEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send deletion OTP:`, error);
    throw error;
  }
};

// Send project deletion confirmation to Projects Officer
const sendProjectDeletionConfirmation = async (projectsOfficerEmail, confirmationData) => {
  const {
    projectName,
    projectId,
    deletedBy,
    deletedByEmail,
    deletedAt,
    applicationsDeleted,
    activeApplicationsDeleted,
    confirmationMessage,
    deletedApplications
  } = confirmationData;

  const subject = `✅ PROJECT DELETION COMPLETED - ${projectName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Deletion Completed - MyDeeptech</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .details { background: #e8f6f3; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .applications-list { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; max-height: 200px; overflow-y: auto; }
          .footer { background: #2c3e50; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0; color: #155724; }
        </style>
    </head>
    <body>
        <div class="container">
          <div class="header">
            <h1>✅ PROJECT DELETION COMPLETED</h1>
            <p>Authorized Deletion Successfully Executed</p>
          </div>
          
          <div class="content">
            <div class="success">
              <strong>✅ DELETION CONFIRMED</strong><br>
              The project deletion has been completed successfully with your authorization.
            </div>

            <div class="details">
              <h3>📋 Deletion Summary</h3>
              <p><strong>Deleted Project:</strong> ${projectName}</p>
              <p><strong>Project ID:</strong> ${projectId}</p>
              <p><strong>Deleted By:</strong> ${deletedBy} (${deletedByEmail})</p>
              <p><strong>Deletion Time:</strong> ${new Date(deletedAt).toLocaleString()}</p>
              <p><strong>Applications Deleted:</strong> ${applicationsDeleted} total (${activeApplicationsDeleted} were active)</p>
              <p><strong>Confirmation:</strong> ${confirmationMessage}</p>
            </div>

            ${deletedApplications && deletedApplications.length > 0 ? `
            <div class="details">
              <h4>📋 Deleted Applications</h4>
              <div class="applications-list">
                ${deletedApplications.map(app => `
                  <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
                    <strong>${app.applicantName}</strong> (${app.applicantEmail})<br>
                    Status: ${app.status} | Applied: ${new Date(app.appliedAt).toLocaleDateString()}
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <div class="details">
              <h4>🔒 Security Log</h4>
              <p><strong>Authorization Method:</strong> OTP Verification</p>
              <p><strong>Authorized By:</strong> Projects Officer (${projectsOfficerEmail})</p>
              <p><strong>Executed By:</strong> ${deletedBy}</p>
              <p><strong>Timestamp:</strong> ${new Date(deletedAt).toLocaleString()}</p>
              <p><strong>Action:</strong> Force Delete with Applications</p>
            </div>

            <div class="success">
              <h4>📝 Next Steps</h4>
              <ul>
                <li>All project data has been permanently removed</li>
                <li>This action has been logged in the system audit trail</li>
                <li>No further action required from Projects Officer</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>MyDeepTech Project Management System</strong></p>
            <p>Deletion completed and confirmed at ${new Date().toLocaleString()}</p>
            <p>This is an automated confirmation for audit purposes.</p>
          </div>
        </div>
    </body>
    </html>
  `;

  const textContent = `
✅ PROJECT DELETION COMPLETED

The authorized project deletion has been successfully executed.

Deletion Summary:
- Project: ${projectName} (ID: ${projectId})
- Deleted By: ${deletedBy} (${deletedByEmail})
- Deletion Time: ${new Date(deletedAt).toLocaleString()}
- Applications Deleted: ${applicationsDeleted} (${activeApplicationsDeleted} active)

${deletedApplications && deletedApplications.length > 0 ? `
Deleted Applications:
${deletedApplications.map(app => `- ${app.applicantName} (${app.applicantEmail}) - ${app.status}`).join('\n')}
` : ''}

Security Log:
- Authorization: OTP Verification
- Authorized By: Projects Officer
- Method: Force Delete with Applications

MyDeepTech Project Management System
Completed: ${new Date().toLocaleString()}
  `;

  try {
    await sendProjectEmail({
      to: projectsOfficerEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Project deletion confirmation sent to: ${projectsOfficerEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send deletion confirmation:`, error);
    throw error;
  }
};

/**
 * Send notification to admin when a user applies to a project
 * @param {string} adminEmail - Admin's email address
 * @param {string} adminName - Admin's full name
 * @param {object} applicationData - Application and project details
 */
const sendProjectApplicationNotification = async (adminEmail, adminName, applicationData) => {
  const { applicantName, applicantEmail, projectName, projectCategory, payRate, coverLetter, appliedAt } = applicationData;
  
  const subject = `New Project Application: ${projectName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Project Application - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">📋 New Project Application</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Someone applied to your project</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${adminName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                You have received a new application for your project <strong>${projectName}</strong>.
            </p>
            
            <div style="background: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #007bff;">📝 Application Details</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Applicant:</td>
                        <td style="padding: 8px 0;">${applicantName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0;">${applicantEmail}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Project:</td>
                        <td style="padding: 8px 0;">${projectName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Category:</td>
                        <td style="padding: 8px 0;">${projectCategory}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Pay Rate:</td>
                        <td style="padding: 8px 0;">$${payRate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Applied:</td>
                        <td style="padding: 8px 0;">${new Date(appliedAt).toLocaleDateString()}</td>
                    </tr>
                </table>
                
                ${coverLetter ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                    <h4 style="margin-bottom: 10px; color: #007bff;">💬 Cover Letter</h4>
                    <p style="font-style: italic; background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 0;">
                        "${coverLetter}"
                    </p>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/admin/projects/applications" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                    Review Application
                </a>
                <a href="https://mydeeptech.ng/admin/projects" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Manage Projects
                </a>
            </div>
            
            <div style="background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0056b3;">⏰ Action Required</h3>
                <p style="margin-bottom: 0;">Please review this application and respond within 7 days. You can approve or reject the application from your admin dashboard.</p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #007bff;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Hi ${adminName},

You have received a new application for your project: ${projectName}

Application Details:
- Applicant: ${applicantName}
- Email: ${applicantEmail}
- Project: ${projectName}
- Category: ${projectCategory}
- Pay Rate: $${payRate}
- Applied: ${new Date(appliedAt).toLocaleDateString()}

${coverLetter ? `Cover Letter: "${coverLetter}"` : ''}

Please review this application and respond within 7 days. You can approve or reject the application from your admin dashboard.

Review applications: https://mydeeptech.ng/admin/projects/applications
Manage projects: https://mydeeptech.ng/admin/projects

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendProjectEmail({
      to: adminEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Project application notification sent to admin: ${adminEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send project application notification to ${adminEmail}:`, error);
    throw error;
  }
};

/**
 * Send approval notification to applicant
 * @param {string} applicantEmail - Applicant's email address
 * @param {string} applicantName - Applicant's full name
 * @param {object} projectData - Project details
 */
const sendProjectApprovalNotification = async (applicantEmail, applicantName, projectData) => {
  const { projectName, projectCategory, payRate, adminName, reviewNotes } = projectData;
  
  const subject = `Application Approved: ${projectName}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Approved - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your application has been approved</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${applicantName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! Your application for <strong>${projectName}</strong> has been approved. 
                You can now start working on this project.
            </p>
            
            <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #155724;">✅ Project Details</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Project:</td>
                        <td style="padding: 8px 0;">${projectName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Category:</td>
                        <td style="padding: 8px 0;">${projectCategory}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Pay Rate:</td>
                        <td style="padding: 8px 0;">$${payRate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Approved By:</td>
                        <td style="padding: 8px 0;">${adminName}</td>
                    </tr>
                </table>
                
                ${reviewNotes ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #c3e6cb;">
                    <h4 style="margin-bottom: 10px; color: #155724;">💬 Admin Notes</h4>
                    <p style="font-style: italic; background: #ffffff; padding: 15px; border-radius: 5px; margin: 0;">
                        "${reviewNotes}"
                    </p>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/projects/dashboard" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Start Working
                </a>
            </div>
            
            <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0c5460;">🚀 Next Steps</h3>
                <ul style="margin-bottom: 0; padding-left: 20px;">
                    <li>Log in to your MyDeeptech dashboard</li>
                    <li>Access the project workspace</li>
                    <li>Review project guidelines and requirements</li>
                    <li>Start working on assigned tasks</li>
                </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #28a745;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Hi ${applicantName},

Great news! Your application for "${projectName}" has been approved. You can now start working on this project.

Project Details:
- Project: ${projectName}
- Category: ${projectCategory}
- Pay Rate: $${payRate}
- Approved By: ${adminName}

${reviewNotes ? `Admin Notes: "${reviewNotes}"` : ''}

Next Steps:
1. Log in to your MyDeeptech dashboard
2. Access the project workspace
3. Review project guidelines and requirements
4. Start working on assigned tasks

Start working: https://mydeeptech.ng/projects/dashboard

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendProjectEmail({
      to: applicantEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Project approval notification sent to: ${applicantEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send project approval notification to ${applicantEmail}:`, error);
    throw error;
  }
};

/**
 * Send rejection notification to applicant
 * @param {string} applicantEmail - Applicant's email address
 * @param {string} applicantName - Applicant's full name
 * @param {object} projectData - Project details
 */
const sendProjectRejectionNotification = async (applicantEmail, applicantName, projectData) => {
  const { projectName, projectCategory, adminName, rejectionReason, reviewNotes } = projectData;
  
  const subject = `Application Update: ${projectName}`;
  
  const reasonText = {
    'insufficient_experience': 'Insufficient experience for this project',
    'not_suitable_skills': 'Skills do not match project requirements',
    'project_full': 'Project has reached maximum capacity',
    'application_quality': 'Application needs improvement',
    'availability_mismatch': 'Availability does not match project timeline',
    'rate_mismatch': 'Rate expectations do not align',
    'other': 'Other reasons (see admin notes)'
  };
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Update - MyDeeptech</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">📋 Application Update</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Regarding your project application</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Hi <strong>${applicantName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
                Thank you for your interest in <strong>${projectName}</strong>. After careful review, 
                we have decided not to move forward with your application at this time.
            </p>
            
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">📋 Application Details</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Project:</td>
                        <td style="padding: 8px 0;">${projectName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Category:</td>
                        <td style="padding: 8px 0;">${projectCategory}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Reviewed By:</td>
                        <td style="padding: 8px 0;">${adminName}</td>
                    </tr>
                    ${rejectionReason ? `
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Reason:</td>
                        <td style="padding: 8px 0;">${reasonText[rejectionReason] || rejectionReason}</td>
                    </tr>
                    ` : ''}
                </table>
                
                ${reviewNotes ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ffeaa7;">
                    <h4 style="margin-bottom: 10px; color: #856404;">💬 Feedback</h4>
                    <p style="font-style: italic; background: #ffffff; padding: 15px; border-radius: 5px; margin: 0;">
                        "${reviewNotes}"
                    </p>
                </div>
                ` : ''}
            </div>
            
            <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0c5460;">🌟 Don't Give Up!</h3>
                <p style="margin-bottom: 0;">
                    We encourage you to apply to other projects that match your skills and experience. 
                    Keep improving your profile and we may have opportunities for you in the future.
                </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://mydeeptech.ng/projects" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Browse Other Projects
                </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>MyDeeptech Team</strong><br>
                <a href="https://mydeeptech.ng" style="color: #ffc107;">mydeeptech.ng</a>
            </p>
        </div>
    </body>
    </html>
  `;

  const textContent = `
Hi ${applicantName},

Thank you for your interest in "${projectName}". After careful review, we have decided not to move forward with your application at this time.

Application Details:
- Project: ${projectName}
- Category: ${projectCategory}
- Reviewed By: ${adminName}
${rejectionReason ? `- Reason: ${reasonText[rejectionReason] || rejectionReason}` : ''}

${reviewNotes ? `Feedback: "${reviewNotes}"` : ''}

Don't Give Up!
We encourage you to apply to other projects that match your skills and experience. Keep improving your profile and we may have opportunities for you in the future.

Browse other projects: https://mydeeptech.ng/projects

Best regards,
MyDeeptech Team
https://mydeeptech.ng
  `;

  try {
    await sendProjectEmail({
      to: applicantEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Project rejection notification sent to: ${applicantEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send project rejection notification to ${applicantEmail}:`, error);
    throw error;
  }
};

module.exports = {
  sendProjectApplicationNotification,
  sendProjectApprovalNotification,
  sendProjectRejectionNotification,
  sendProjectDeletionOTP,
  sendProjectDeletionConfirmation
};