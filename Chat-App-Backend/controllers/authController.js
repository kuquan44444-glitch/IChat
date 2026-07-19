const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailService = require("../services/mailer");
const crypto = require("crypto");

const filterObj = require("../utils/filterObj");

// Model
const User = require("../models/user");
const otp = require("../Templates/Mail/otp");
const resetPassword = require("../Templates/Mail/resetPassword");
const { promisify } = require("util");
const catchAsync = require("../utils/catchAsync");

// this function will return you jwt token
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const isEmailVerificationEnabled = () =>
  process.env.ENABLE_EMAIL_VERIFICATION === "true";

const createAuthResponse = (user, message) => ({
  status: "success",
  message,
  token: signToken(user._id),
  user_id: user._id,
  user: {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    about: user.about,
    verified: user.verified,
  },
});

// Register New User



exports.register = catchAsync(async (req, res, next) => {
  const email = req.body.email?.toLowerCase();

  const filteredBody = filterObj(
    { ...req.body, email },
    "firstName",
    "lastName",
    "email",
    "password"
  );

  // check if a verified user with given email exists

  const existing_user = await User.findOne({ email: email });

  if (existing_user && existing_user.verified) {
    // user with this email already exists, Please login
    return res.status(400).json({
      status: "error",
      message: "Email already in use, Please login.",
    });
  } else if (existing_user) {
    existing_user.firstName = filteredBody.firstName;
    existing_user.lastName = filteredBody.lastName;
    existing_user.email = filteredBody.email;
    existing_user.password = filteredBody.password;
    existing_user.verified = !isEmailVerificationEnabled();

    if (!isEmailVerificationEnabled()) {
      existing_user.otp = undefined;
      existing_user.otp_expiry_time = undefined;
    }

    await existing_user.save();

    if (!isEmailVerificationEnabled()) {
      return res.status(201).json({
        ...createAuthResponse(existing_user, "Registered successfully!"),
        requiresEmailVerification: false,
      });
    }

    req.userId = existing_user._id;
    return next();
  } else {
    const new_user = await User.create({
      ...filteredBody,
      verified: !isEmailVerificationEnabled(),
    });

    if (!isEmailVerificationEnabled()) {
      return res.status(201).json({
        ...createAuthResponse(new_user, "Registered successfully!"),
        requiresEmailVerification: false,
      });
    }

    req.userId = new_user._id;
    return next();
  }
});

exports.sendOTP = catchAsync(async (req, res, next) => {
  if (!isEmailVerificationEnabled()) {
    return res.status(200).json({
      status: "success",
      message: "Email verification is disabled.",
      requiresEmailVerification: false,
    });
  }

  let userId = req.userId;

  if (!userId && req.body.email) {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    userId = user?._id;
  }

  if (!userId) {
    return res.status(400).json({
      status: "error",
      message: "Unable to identify user for OTP delivery",
    });
  }

  const new_otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10 Mins after otp is sent

  const user = await User.findByIdAndUpdate(userId, {
    otp_expiry_time: otp_expiry_time,
  });

  user.otp = new_otp.toString();

  await user.save({ new: true, validateModifiedOnly: true });

  console.log(new_otp);

  // TODO send mail
  mailService.sendEmail({
    from: "infogmk02@gmail.com",
    to: user.email,
    subject: "Verification OTP",
    html: otp(user.firstName, new_otp),
    attachments: [],
  });

  res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
    requiresEmailVerification: true,
  });
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  // verify otp and update user accordingly
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
    res.status(400).json({
      status: "error",
      message: "OTP is incorrect",
    });

    return;
  }

  // OTP is correct

  user.verified = true;
  user.otp = undefined;
  await user.save({ new: true, validateModifiedOnly: true });

  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "OTP verified Successfully!",
    token,
    user_id: user._id,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: "error",
      message: "Incorrect email or password",
    });
  }

  if (isEmailVerificationEnabled() && !user.verified) {
    return res.status(403).json({
      status: "error",
      message: "Please verify your email before logging in",
    });
  }

  res.status(200).json(createAuthResponse(user, "Logged in successfully!"));
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
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
      message: "You are not logged in! Please log in to get access.",
    });
  }
  
  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.userId);

  if (!currentUser) {
    return res.status(401).json({
      message: "The user belonging to this token no longer exists.",
    });
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      message: "User recently changed password! Please log in again.",
    });
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "There is no user with email address.",
    });
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const clientUrl =
      process.env.CLIENT_URL || req.get("origin") || `${req.protocol}://${req.get("host")}`;
    const resetURL = `${clientUrl}/auth/new-password?token=${resetToken}`;
    // TODO => Send Email with this Reset URL to user's email address

    console.log(resetURL);

    mailService.sendEmail({
      from: "infogmk02@gmail.com",
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

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
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

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "Password Reseted Successfully",
    token,
  });
});
