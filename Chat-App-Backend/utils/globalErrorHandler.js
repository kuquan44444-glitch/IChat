const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      status: err.status || "error",
      message: err.message,
    });
  }

  console.error("UNEXPECTED_ERROR", err);

  return res.status(500).json({
    status: "error",
    message: "Something went wrong",
  });
};

module.exports = (err, req, res, next) => {
  const normalizedError = {
    ...err,
    message: err.message || "Internal Server Error",
    statusCode: err.statusCode || 500,
    status: err.status || "error",
    isOperational: err.isOperational || false,
  };

  if (process.env.NODE_ENV === "development") {
    return sendErrorDev(normalizedError, res);
  }

  return sendErrorProd(normalizedError, res);
};
