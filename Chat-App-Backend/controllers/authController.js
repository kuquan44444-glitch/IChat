const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailService = require("../services/mailer");
const crypto = require("crypto");
const { promisify } = require("util");

const filterObj = require("../utils/filterObj");
const User = require("../models/user");
const otpTemplate = require("../Templates/Mail/otp");
const resetPasswordTemplate = require("../Templates/Mail/resetPassword");
const catchAsync = require("../utils/catchAsync");

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

const isEmailVerificationEnabled = () =>
  String(process.env.ENABLE_EMAIL_VERIFICATION || "true").toLowerCase() === "true";

const sendAuthResponse = (res, user, message, extra = {}) => {
  const token = signToken(user._id);

  return res.status(200).json({
    status: "success",
    message,
    token,
    user_id: user._id,
    ...extra,
  });
};

const generateAndSendOTP = async (user) => {
  const newOtp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  user.otp_expiry_time = new Date(Date.now() + 10 * 60 * 1000);
  user.otp = newOtp.toString();

  await user.save({ new: true, validateModifiedOnly: true });

  await mailService.sendEmail({
    from: process.env.EMAIL_FROM || "infogmk02@gmail.com",
    to: user.email,
    subject: "Verification OTP",
    html: otpTemplate(user.firstName, newOtp),
    attachments: [],
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "email",
    "password"
  );

  const existingUser = await User.findOne({ email: filteredBody.email });
  const emailVerificationEnabled = isEmailVerificationEnabled();
  let user;

  if (existingUser && existingUser.verified) {
    return res.status(400).json({
      status: "error",
      message: "Email already in use, Please login.",
    });
  }

  if (existingUser) {
    existingUser.firstName = filteredBody.firstName;
    existingUser.lastName = filteredBody.lastName;
    existingUser.email = filteredBody.email;
    existingUser.password = filteredBody.password;
    existingUser.verified = !emailVerificationEnabled;
    user = await existingUser.save({ new: true, validateModifiedOnly: true });
  } else {
    user = await User.create({
      ...filteredBody,
      verified: !emailVerificationEnabled,
    });
  }

  if (!emailVerificationEnabled) {
    user.verified = true;
    user.otp = undefined;
    user.otp_expiry_time = undefined;
    await user.save({ new: true, validateModifiedOnly: true });

    return sendAuthResponse(res, user, "Registered and logged in successfully!", {
      requiresEmailVerification: false,
    });
  }

  await generateAndSendOTP(user);

  return res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
    requiresEmailVerification: true,
  });
});

exports.sendOTP = catchAsync(async (req, res, next) => {
  if (!isEmailVerificationEnabled()) {
    return res.status(200).json({
      status: "success",
      message: "Email verification is disabled.",
      requiresEmailVerification: false,
    });
  }

  const userId = req.userId || req.body.userId;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "User not found.",
    });
  }

  await generateAndSendOTP(user);

  return res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
    requiresEmailVerification: true,
  });
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  const user = await User.findOne({
    email,
    otp_expiry_time: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "Email is invalid or OTP expired",
    });
  }

  if (user.verified) {
    return res.status(400).json({
      status: "error",
      message: "Email is already verified",
    });
  }

  if (!(await user.correctOTP(otp, user.otp))) {
    return res.status(400).json({
      status: "error",
      message: "OTP is incorrect",
    });
  }

  user.verified = true;
  user.otp = undefined;
  user.otp_expiry_time = undefined;
  await user.save({ new: true, validateModifiedOnly: true });

  return sendAuthResponse(res, user, "OTP verified Successfully!", {
    requiresEmailVerification: true,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
  }

  const user = await User.findOne({ email });

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(400).json({
      status: "error",
      message: "Email or password is incorrect",
    });
  }

  if (isEmailVerificationEnabled() && !user.verified) {
    return res.status(403).json({
      status: "error",
      message: "Please verify your email before logging in.",
      requiresEmailVerification: true,
    });
  }

  return sendAuthResponse(res, user, "Logged in successfully!", {
    requiresEmailVerification: false,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "You are not logged in! Please log in to get access.",
    });
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.userId);

  if (!currentUser) {
    return res.status(401).json({
      status: "error",
      message: "The user belonging to this token no longer exists.",
    });
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: "error",
      message: "User recently changed password! Please log in again.",
    });
  }

  req.user = currentUser;
  next();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "There is no user with email address.",
    });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const resetURL = `${frontendUrl.replace(/\/$/, "")}/auth/new-password?token=${resetToken}`;

    await mailService.sendEmail({
      from: process.env.EMAIL_FROM || "infogmk02@gmail.com",
      to: user.email,
      subject: "Reset Password",
      html: resetPasswordTemplate(user.firstName, resetURL),
      attachments: [],
    });

    return res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      status: "error",
      message: "There was an error sending the email. Try again later!",
    });
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "Token is Invalid or Expired",
    });
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return sendAuthResponse(res, user, "Password Reseted Successfully");
});
