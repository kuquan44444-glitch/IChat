const express = require("express");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const compression = require("compression");

const routes = require("./routes/index");

const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongosanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { parseAllowedOrigins } = require("./utils/env");

const app = express();
const clientBuildPath = path.resolve(__dirname, "..", "build");
const hasClientBuild = fs.existsSync(path.join(clientBuildPath, "index.html"));
const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_URL || ""
);

app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000, // In one hour
  message: "Too many Requests from this IP, please try again in an hour!",
});

app.use("/auth", limiter);
app.use("/user", limiter);

app.use(mongosanitize());
app.use(xss());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res, next) => {
  if (hasClientBuild && req.accepts("html")) {
    return res.sendFile(path.join(clientBuildPath, "index.html"));
  }

  return res.status(200).json({
    status: "success",
    message: "Chat application server is running.",
  });
});

app.use(routes);

if (hasClientBuild) {
  app.use(express.static(clientBuildPath));
}

app.get("*", (req, res) => {
  if (hasClientBuild) {
    return res.sendFile(path.join(clientBuildPath, "index.html"));
  }

  return res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const payload = {
    status: err.status || "error",
    message:
      process.env.NODE_ENV === "production" && !err.isOperational
        ? "Internal server error"
        : err.message || "Internal server error",
  };

  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
});

module.exports = app;
