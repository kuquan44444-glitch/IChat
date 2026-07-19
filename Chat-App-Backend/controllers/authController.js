const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailService = require("../services/mailer");
const crypto = require("crypto");
const { promisify } = require("util");

const filterObj = require("../utils/filterObj");
const catchAsync = require("../utils/catchAsync");
const { parseBoolean } = require("../utils/env");

const User = require("../models/user");
const otpTemplate = require("../Templates/Mail/otp");
const resetPassword = require("../Templates/Mail/resetPassword");

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const isEmailVerificationEnabled = () =>
  parseBoolean(process.env.ENABLE_EMAIL_VERIFICATION, false);

const sendAuthResponse = (res, user, message, statusCode = 200) => {
  const token = signToken(user._id);

  return res.status(statusCode).json({
    status: "success",
    message,
    token,
    user_id: user._id,
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

  filteredBody.email = String(filteredBody.email || "").toLowerCase().trim();

  if (
    !filteredBody.firstName ||
    !filteredBody.lastName ||
    !filteredBody.email ||
    !filteredBody.password
  ) {
    return res.status(400).json({
      status: "error",
      message: "First name, last name, email and password are required.",
    });
  }

  let user = await User.findOne({ email: filteredBody.email }).select("+otp");

  if (user && user.verified) {
    return res.status(400).json({
      status: "error",
      message: "Email already in use, Please login.",
    });
  }

  if (!user) {
    user = new User(filteredBody);
  } else {
    user.firstName = filteredBody.firstName;
    user.lastName = filteredBody.lastName;
    user.email = filteredBody.email;
    user.password = filteredBody.password;
    user.verified = false;
    user.otp = undefined;
    user.otp_expiry_time = undefined;
  }

  if (!isEmailVerificationEnabled()) {
    user.verified = true;
    user.otp = undefined;
    user.otp_expiry_time = undefined;
    await user.save();

    return sendAuthResponse(
      res,
      user,
      "Registered successfully. Email verification is disabled.",
      201
    );
  }

  await user.save();
  req.userId = user._id.toString();
  return next();
});

exports.sendOTP = catchAsync(async (req, res) => {
  const userId = req.userId || req.body.userId;
  const email = req.body.email ? String(req.body.email).toLowerCase().trim() : null;

  let user = null;

  if (userId) {
    user = await User.findById(userId).select("+otp");
  } else if (email) {
    user = await User.findOne({ email }).select("+otp");
  }

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "User not found.",
    });
  }

  if (!isEmailVerificationEnabled()) {
    if (!user.verified) {
      user.verified = true;
      user.otp = undefined;
      user.otp_expiry_time = undefined;
      await user.save();
    }

    return sendAuthResponse(
      res,
      user,
      "Email verification is disabled. Login successful."
    );
  }

  const newOTP = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  user.otp = newOTP.toString();
  user.otp_expiry_time = Date.now() + 10 * 60 * 1000;
  await user.save();

  await mailService.sendEmail({
    from: process.env.EMAIL_FROM || "noreply@example.com",
    to: user.email,
    subject: "Verification OTP",
    html: otpTemplate(user.firstName, newOTP),
    attachments: [],
  });

  return res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
  });
});

exports.verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
    otp_expiry_time: { $gt: Date.now() },
  }).select("+otp");

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

  if (!(await user.correctOTP(String(otp || ""), user.otp))) {
    return res.status(400).json({
      status: "error",
      message: "OTP is incorrect",
    });
  }

  user.verified = true;
  user.otp = undefined;
  user.otp_expiry_time = undefined;
  await user.save();

  return sendAuthResponse(res, user, "OTP verified Successfully!");
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password +passwordChangedAt"
  );

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: "error",
      message: "Incorrect email or password.",
    });
  }

  if (isEmailVerificationEnabled() && !user.verified) {
    return res.status(403).json({
      status: "error",
      message: "Please verify your email before logging in.",
    });
  }

  return sendAuthResponse(res, user, "Logged in successfully!");
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
  const currentUser = await User.findById(decoded.userId).select("+passwordChangedAt");

  if (!currentUser) {
    return res.status(401).json({
      status: "error",
      message: "The user belonging to this token no longer exists.",
    });
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: "error",
      message: "User recently changed password. Please log in again.",
    });
  }

  req.user = currentUser;
  return next();
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const user = await User.findOne({
    email: String(req.body.email || "").toLowerCase().trim(),
  });
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "There is no user with email address.",
    });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const clientUrl =
      process.env.CLIENT_URL ||
      req.get("origin") ||
      `${req.protocol}://${req.get("host")}`;
    const resetURL = `${clientUrl}/auth/new-password?token=${resetToken}`;

    await mailService.sendEmail({
      from: process.env.EMAIL_FROM || "noreply@example.com",
      to: user.email,
      subject: "Reset Password",
      html: resetPassword(user.firstName, resetURL),
      attachments: [],
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      message: "There was an error sending the email. Try again later!",
    });
  }
});

exports.resetPassword = catchAsync(async (req, res) => {
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
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return sendAuthResponse(res, user, "Password Reseted Successfully");
});
