const mongoose = require("mongoose");

const isDevelopment = process.env.NODE_ENV === "development";

const formatMongooseError = (err) => {
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((issue) => issue.message)
      .join(". ");

    return {
      statusCode: 400,
      status: "fail",
      message: message || "Validation failed",
    };
  }

  if (err.code === 11000) {
    return {
      statusCode: 409,
      status: "fail",
      message: "A record with that value already exists.",
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: 400,
      status: "fail",
      message: `Invalid ${err.path}: ${err.value}`,
    };
  }

  if (err.name === "JsonWebTokenError") {
    return {
      statusCode: 401,
      status: "fail",
      message: "Invalid token. Please log in again.",
    };
  }

  if (err.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      status: "fail",
      message: "Your token has expired. Please log in again.",
    };
  }

  return null;
};

module.exports = (err, req, res, next) => {
  const normalized = formatMongooseError(err);
  const statusCode = normalized?.statusCode || err.statusCode || 500;
  const status = normalized?.status || err.status || "error";
  const message =
    normalized?.message || err.message || "Something went wrong on the server.";

  if (isDevelopment) {
    return res.status(statusCode).json({
      status,
      message,
      error: err,
      stack: err.stack,
    });
  }

  return res.status(statusCode).json({
    status,
    message,
  });
};
