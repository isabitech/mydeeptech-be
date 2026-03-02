const path = require('path');
const fs = require('fs');
const brevo = require('@getbrevo/brevo');
const mailJet = require("../../utils/mailjet-init");
const envConfig = require('../../config/envConfig');
const AppError = require('../../utils/app-error');

// Initialize Brevo API client
const brevoApiInstance = new brevo.TransactionalEmailsApi();
brevoApiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, envConfig.email.brevo.BREVO_API_KEY);


class BaseMailService {
  constructor() {}

    static replaceTemplatePlaceholders(template, placeholder, value) {
        const regex = new RegExp(placeholder, 'g');
        return template.replace(regex, value);
    }

    static getMailTemplateFromPath(templateName) {
        const emailTemplatePath = path.join(__dirname, '..', '..', 'emailTemplates', `${templateName}.html`);
        if (!fs.existsSync(emailTemplatePath)) {
            throw new AppError({ message: `Email template "${templateName}" not found`, statusCode: 500 });
        }
        const template = fs.readFileSync(emailTemplatePath, 'utf-8');
        return template;
    }

    static getMailTemplate(templateName) {
        return this.getMailTemplateFromPath(templateName);
    }

    // Main sendMail method - routes to the configured email provider
    static async sendMail(options = {}) {
        // Get email provider from config (default to 'brevo')
        const emailProvider = envConfig.email?.defaultProvider || 'brevo';

        // console.log("MAIL OPTIONS:", {
        //     recipientEmail: options.recipientEmail,
        //     recipientName: options.recipientName,
        //     subject: options.subject,
        //     senderEmail: options.senderEmail,
        //     senderName: options.senderName,
        //     emailProvider: emailProvider,
        //     timestamp: new Date().toISOString(),
        // });

        try {
            console.log(`Sending email via ${emailProvider.toUpperCase()} provider`);
            switch (emailProvider.toLowerCase()) {
                case 'brevo':
                    return await this.sendMailWithBrevo(options);
                case 'mailjet':
                default:
                    return await this.sendMailWithMailJet(options);
            }
        } catch (primaryError) {
            console.error(`Primary email provider (${emailProvider}) failed:`, primaryError.message);

            // Implement fallback logic
            const fallbackProvider = emailProvider === 'mailjet' ? 'brevo' : 'mailjet';

            try {
                console.log(`Attempting fallback to ${fallbackProvider.toUpperCase()}`);
                if (fallbackProvider === 'brevo') {
                    return await this.sendMailWithBrevo(options);
                } else {
                    return await this.sendMailWithMailJet(options);
                }
            } catch (fallbackError) {
                console.error(`Fallback email provider (${fallbackProvider}) also failed:`, fallbackError.message);
                throw new AppError({ 
                    message: `All email providers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`, 
                    statusCode: 500,
                });
            }
        }
    }

    static async sendMailWithMailJet(options = {}) {
  
      const { 
          recipientEmail, 
          recipientName, 
          subject, 
          message, 
          htmlTemplate,
          senderEmail,
          senderName 
      } = options || {};
  
      if (!recipientEmail || !subject) {
          throw new AppError({ message: 'Recipient email and subject are required', statusCode: 400 });
      }

      // Use provided sender details or fall back to default
      const fromEmail = senderEmail || envConfig.email.mailjet.MAILJET_SENDER_EMAIL;
      const fromName = senderName || envConfig.email.mailjet.MAILJET_SENDER_NAME || "MyDeepTech";
  
          try {
             const infoMail =  await mailJet
              .post('send', { version: 'v3.1' })
              .request({
                  Messages: [
                      {
                          From: {
                              Email: fromEmail,
                              Name: fromName
                          },
                          To: [
                              {
                                  Email: recipientEmail,
                                  Name: recipientName,
                              },
                          ],
                          Subject: subject,
                          HTMLPart: htmlTemplate,
                          TextPart: message,
                      },
                  ],
              });
              console.log('Email sent successfully via MailJet:', {
                  recipient: recipientEmail,
                  subject: subject,
                  timestamp: new Date().toISOString()
              });
             return infoMail;
          } catch (error) {
              console.error("ERROR SENDING EMAIL VIA MAIL_JET:", {
                  message: error.message,
                  statusCode: error.statusCode,
                  response: error.response?.data,
                  timestamp: new Date().toISOString()
              });
              throw new AppError({ message: `Error sending email via MAIL_JET: ${error.message}`, statusCode: 500 });
          }   
    }

    static async sendMailWithBrevo(options = {}) {

        const {
            recipientEmail, 
            recipientName, 
            subject, 
            message, 
            htmlTemplate,
            senderEmail,
            senderName 
        } = options || {};
    
        if (!recipientEmail || !subject) {
            throw new AppError({ message: 'Recipient email and subject are required', statusCode: 400 });
        }
  
        // Use provided sender details or fall back to default
        const fromEmail = senderEmail || envConfig.email.brevo.BREVO_SENDER_EMAIL;
        const fromName = senderName || envConfig.email.brevo.BREVO_SENDER_NAME || "MyDeepTech";
    
        try {
            // Use modern SendSmtpEmail initialization (consistent with brevoMailer.js)
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            
            // Configure email content
            sendSmtpEmail.subject = subject;
            sendSmtpEmail.htmlContent = htmlTemplate;
            sendSmtpEmail.textContent = message;
            
            // Configure sender
            sendSmtpEmail.sender = {
                name: fromName,
                email: fromEmail
            };
            
            sendSmtpEmail.to = [{
                email: recipientEmail,
                name: recipientName
            }];
            
            // Send email using the properly configured API instance
            const result = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
            
            console.log('Email sent successfully:', {
                recipient: recipientEmail,
                subject: subject,
                messageId: result.messageId,
                timestamp: new Date().toISOString()
            });
           return result;
        } catch (error) {
            console.error("ERROR SENDING EMAIL VIA BREVO:", {
                message: error.message,
                statusCode: error.statusCode,
                response: error.response?.data,
                timestamp: new Date().toISOString()
            });
            throw new AppError({ message: `Error sending email via Brevo: ${error.message}`, statusCode: 500 });
        }   
    }
}

module.exports = BaseMailService;