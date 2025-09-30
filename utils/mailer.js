const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // your gmail address
    pass: process.env.MAIL_PASS, // app password
  },
});

module.exports = transporter;