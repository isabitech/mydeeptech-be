const Mailjet = require('node-mailjet');
const envConfig = require('../config/envConfig');

// Only initialize Mailjet if API credentials are provided
let mailJet = null;

if (envConfig.email.mailjet.MAILJET_API_KEY && envConfig.email.mailjet.MAILJET_SECRET_KEY) {
    mailJet = new Mailjet({
        apiKey: envConfig.email.mailjet.MAILJET_API_KEY,
        apiSecret: envConfig.email.mailjet.MAILJET_SECRET_KEY
    });
} else {
    console.log('Mailjet credentials not found, Mailjet will not be available');
}

module.exports = mailJet;