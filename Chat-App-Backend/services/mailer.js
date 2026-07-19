const sgMail = require("@sendgrid/mail");

if (process.env.SG_KEY) {
  sgMail.setApiKey(process.env.SG_KEY);
}

const sendSGMail = async ({
  to,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
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
  }
};

exports.sendEmail = async (args) => {
  if (!process.env.SG_KEY) {
    return Promise.resolve();
  }

  return sendSGMail(args);
};
