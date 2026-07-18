const fs = require("fs");
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongosanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("cookie-session");

const routes = require("./routes/index");
const AppError = require("./utils/AppError");
const globalErrorHandler = require("./utils/globalErrorHandler");

const app = express();
const frontendBuildPath = path.resolve(__dirname, "../chat-app-latest/build");
const hasFrontendBuild = fs.existsSync(
  path.join(frontendBuildPath, "index.html")
);

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError("CORS origin is not allowed", 403));
    },
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    name: "ichat_session",
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "ichat-session",
    proxy: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

app.use("/auth", limiter);
app.use(mongosanitize());
app.use(xss());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use(routes);

if (hasFrontendBuild) {
  app.use(express.static(frontendBuildPath));

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/auth/") ||
      req.path.startsWith("/user/") ||
      req.path === "/health"
    ) {
      return next();
    }

    return res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "IChat API is running. Build the frontend to serve the React app.",
    });
  });
}

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
