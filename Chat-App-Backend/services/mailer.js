const sgMail = require("@sendgrid/mail");

const isSendGridConfigured = () => Boolean(process.env.SG_KEY);

const ensureSendGridClient = () => {
  if (!isSendGridConfigured()) {
    throw new Error("SendGrid is not configured");
  }

  sgMail.setApiKey(process.env.SG_KEY);
};

const sendSGMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
    ensureSendGridClient();

    const from = "infogmk01@gmail.com";

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
    throw error;
  }
};

exports.sendEmail = async (args) => {
  return sendSGMail(args);
};
