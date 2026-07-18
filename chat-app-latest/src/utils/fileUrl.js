import { AWS_S3_REGION, S3_BUCKET_NAME } from "../config";

export const getStorageFileUrl = (value) => {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (S3_BUCKET_NAME && AWS_S3_REGION) {
    return `https://${S3_BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${value}`;
  }

  return value;
};
