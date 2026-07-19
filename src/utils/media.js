const MEDIA_BASE_URL =
  process.env.REACT_APP_MEDIA_BASE_URL ||
  process.env.REACT_APP_S3_PUBLIC_BASE_URL ||
  "";

export const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (!MEDIA_BASE_URL) {
    return value;
  }

  return `${MEDIA_BASE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
};
