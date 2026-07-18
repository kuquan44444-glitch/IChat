const express = require("express");
const morgan = require("morgan");
const path = require("path");

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
const errorController = require("./controllers/errorController");

const app = express();
const buildPath = path.resolve(__dirname, "../chat-app-latest/build");

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
  credentials: true,
};

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());

app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    name: "ichat-session",
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "ichat-session",
    proxy: true,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

const authLimiter = rateLimit({
  max: 300,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour.",
});

app.use("/auth", authLimiter);
app.use(mongosanitize());
app.use(xss());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(routes);

app.use(express.static(buildPath, { index: false }));

app.get("/", (req, res) => {
  if (req.accepts("html")) {
    return res.sendFile(path.join(buildPath, "index.html"), (err) => {
      if (err) {
        res.status(200).json({
          status: "ok",
          message: "IChat backend is running.",
        });
      }
    });
  }

  return res.status(200).json({
    status: "ok",
    message: "IChat backend is running.",
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/user")) {
    return next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
  }

  if (req.accepts("html")) {
    return res.sendFile(path.join(buildPath, "index.html"), (err) => {
      if (err) {
        next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
      }
    });
  }

  return next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

app.use(errorController);

module.exports = app;
