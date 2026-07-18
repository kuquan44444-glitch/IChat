const sgMail = require("@sendgrid/mail");

const sendSGMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  if (!process.env.SG_KEY) {
    throw new Error("SG_KEY environment variable is required to send email");
  }

  sgMail.setApiKey(process.env.SG_KEY);

  const from = process.env.EMAIL_FROM || "infogmk01@gmail.com";

  const msg = {
    to,
    from,
    subject,
    html,
    text,
    attachments,
  };

  return sgMail.send(msg);
};

exports.sendEmail = async (args) => {
  return sendSGMail(args);
};
