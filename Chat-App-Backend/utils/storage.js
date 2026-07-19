const AWS = require("aws-sdk");
const crypto = require("crypto");

const getS3Client = () => {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("AWS S3 credentials are not configured");
  }

  return new AWS.S3({
    signatureVersion: "v4",
    region,
    accessKeyId,
    secretAccessKey,
  });
};

const getPublicFileUrl = (key) => {
  if (!key) {
    return "";
  }

  if (/^https?:\/\//i.test(key)) {
    return key;
  }

  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  if (process.env.S3_BUCKET_NAME && process.env.AWS_REGION) {
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  return key;
};

const createUploadTarget = ({ folder = "files", originalName = "file", contentType }) => {
  const extension = originalName.includes(".")
    ? `.${originalName.split(".").pop()}`
    : "";
  const safeFolder = folder.replace(/^\/+|\/+$/g, "");
  const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}${extension}`;

  return {
    key,
    contentType,
    fileUrl: getPublicFileUrl(key),
  };
};

const createSignedUploadUrl = async ({ key, contentType }) => {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error("S3 bucket is not configured");
  }

  const s3 = getS3Client();
  const params = {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Expires: 60 * 5,
  };

  if (process.env.S3_UPLOAD_ACL) {
    params.ACL = process.env.S3_UPLOAD_ACL;
  }

  return s3.getSignedUrlPromise("putObject", params);
};

module.exports = {
  createSignedUploadUrl,
  createUploadTarget,
  getPublicFileUrl,
};
