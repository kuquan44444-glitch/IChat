const normalizeBooleanEnv = (value, defaultValue) => {
  if (value === undefined) {
    return defaultValue;
  }

  return !["false", "0", "no", "off"].includes(String(value).toLowerCase());
};

const isEmailVerificationEnabled = () =>
  normalizeBooleanEnv(process.env.ENABLE_EMAIL_VERIFICATION, true);

module.exports = {
  isEmailVerificationEnabled,
};
