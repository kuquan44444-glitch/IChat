import { AWS_S3_REGION, S3_BUCKET_NAME } from "../config";

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

export const getAssetUrl = (value) => {
  if (!value) {
    return "";
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  if (!S3_BUCKET_NAME || !AWS_S3_REGION) {
    return value;
  }

  return `https://${S3_BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${value}`;
};

export default getAssetUrl;
