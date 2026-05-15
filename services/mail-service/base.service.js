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

        // console.log("📧 EMAIL SEND REQUEST:", {
        //     recipientEmail: options.recipientEmail,
        //     recipientName: options.recipientName,
        //     subject: options.subject,
        //     senderEmail: options.senderEmail,
        //     senderName: options.senderName,
        //     emailProvider: emailProvider,
        //     timestamp: new Date().toISOString(),
        // });

        try {
            let result;
            switch (emailProvider.toLowerCase()) {
                case 'brevo':
                    result = await this.sendMailWithBrevo(options);
                    break;
                case 'mailjet':
                default:
                    result = await this.sendMailWithMailJet(options);
                    break;
            }
            return result;
        } catch (primaryError) {
            console.error(`❌ Primary email provider (${emailProvider}) failed:`, primaryError.message);

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
          senderName,
          mailjetMessageOptions = {},
      } = options || {};
  
      if (!recipientEmail || !subject) {
          throw new AppError({ message: 'Recipient email and subject are required', statusCode: 400 });
      }

      if (!mailJet) {
          throw new AppError({ message: 'Mailjet is not configured', statusCode: 500 });
      }

      // Use provided sender details or fall back to default
      const fromEmail = senderEmail || envConfig.email.mailjet.MAILJET_SENDER_EMAIL;
      const fromName = senderName || envConfig.email.mailjet.MAILJET_SENDER_NAME || "MyDeepTech";

      const messagePayload = {
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
          ...mailjetMessageOptions,
      };
  
          try {
             const infoMail =  await mailJet
              .post('send', { version: 'v3.1' })
              .request({
                  AdvanceErrorHandling: true,
                  Messages: [
                      messagePayload,
                  ],
              });
            //   console.log('Email sent successfully via MailJet:', {
            //       recipient: recipientEmail,
            //       subject: subject,
            //       timestamp: new Date().toISOString()
            //   });
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
            
            // console.log('✅ BREVO API RESPONSE - SUCCESS:', {
            //     recipient: recipientEmail,
            //     subject: subject,
            //     messageId: result.body?.messageId || result.messageId || 'No messageId returned',
            //     brevoMessageId: result.body?.messageId,
            //     statusCode: result.response?.statusCode,
            //     // brevoResponse: result,
            //     deliveryInfo: {
            //         provider: 'Brevo',
            //         status: 'Queued for delivery',
            //         note: 'Email accepted by Brevo API - check recipient spam/junk folder if not received'
            //     },
            //     timestamp: new Date().toISOString()
            // });

            // Return enhanced result with delivery tracking info
            return {
                // ...result,
                deliveryInfo: {
                    provider: 'Brevo', 
                    messageId: result.body?.messageId || result.messageId,
                    status: 'accepted',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error("❌ BREVO API RESPONSE - ERROR:", {
                message: error.message,
                statusCode: error.statusCode,
                response: error.response?.data,
                recipient: recipientEmail,
                subject: subject,
                fullError: error,
                timestamp: new Date().toISOString()
            });
            throw new AppError({ message: `Error sending email via Brevo: ${error.message}`, statusCode: 500 });
        }   
    }
}

module.exports = BaseMailService;
