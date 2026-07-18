const sgMail = require("@sendgrid/mail");

const sendSGMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
    const from = sender || process.env.EMAIL_FROM || "infogmk01@gmail.com";

    const msg = {
      to: to, // Change to your recipient
      from: from, // Change to your verified sender
      subject: subject,
      html: html,
      // text: text,
      attachments,
    };

    
    return sgMail.send(msg);
  } catch (error) {
    console.log(error);
  }
};

exports.sendEmail = async (args) => {
  if (!process.env.SG_KEY) {
    return Promise.resolve();
  }

  sgMail.setApiKey(process.env.SG_KEY);
  return sendSGMail(args);
};
