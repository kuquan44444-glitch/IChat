const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
};

const parseAllowedOrigins = (value) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const validateEnvironment = () => {
  const missing = ["DATABASE", "JWT_SECRET"].filter(
    (key) => !process.env[key] || !String(process.env[key]).trim()
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

module.exports = {
  parseBoolean,
  parseAllowedOrigins,
  validateEnvironment,
};
