export const getFileUrl = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return value.url || value.preview || "";
  }

  return "";
};
