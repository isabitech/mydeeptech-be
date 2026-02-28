const mailJet = require("../../utils/mailjet-init");
const envConfig = require('../../config/envConfig');
const AppError = require('../../utils/app-error');
const path = require('path');
const fs = require('fs');

const getMailTemplate = (templateName) => {
    const emailTemplatePath = path.join(__dirname, '..', '..', 'emailTemplates', `${templateName}.html`);
    if (!fs.existsSync(emailTemplatePath)) {
        throw new AppError({ message: `Email template "${templateName}" not found`, statusCode: 500 });
    }
    const template = fs.readFileSync(emailTemplatePath, 'utf-8');
    return template;
};


class BaseMailService {
  constructor() {}

  static getMailTemplate(templateName) {
      return getMailTemplate(templateName);
  }

  static replaceTemplatePlaceholders(template, placeholder, value) {
      const regex = new RegExp(placeholder, 'g');
      return template.replace(regex, value);
  }

     static async sendMail(options = {}) {
  
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

}

module.exports = BaseMailService;