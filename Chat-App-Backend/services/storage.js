const AWS = require("aws-sdk");
const crypto = require("crypto");
const path = require("path");

const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION;

let s3;

if (bucketName && region && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3 = new AWS.S3({
    signatureVersion: "v4",
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

const isStorageConfigured = () => Boolean(s3 && bucketName && region);

const sanitizeFileName = (fileName = "file") =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

const generateObjectKey = ({ folder = "uploads", fileName = "file", userId }) => {
  const extension = path.extname(fileName || "") || "";
  const baseName = sanitizeFileName(path.basename(fileName || "file", extension));
  const randomId = crypto.randomBytes(8).toString("hex");
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");

  return `${safeFolder}/${userId}/${Date.now()}-${randomId}-${baseName}${extension}`;
};

const getPublicUrl = (key) => {
  if (!key) {
    return "";
  }

  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  if (!bucketName || !region) {
    return key;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

const createSignedUploadUrl = async ({ key, contentType, expiresIn = 300 }) => {
  if (!isStorageConfigured()) {
    throw new Error("S3 upload is not configured");
  }

  const signedUrl = await s3.getSignedUrlPromise("putObject", {
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    Expires: expiresIn,
  });

  return {
    key,
    signedUrl,
    publicUrl: getPublicUrl(key),
  };
};

module.exports = {
  isStorageConfigured,
  generateObjectKey,
  createSignedUploadUrl,
  getPublicUrl,
};
