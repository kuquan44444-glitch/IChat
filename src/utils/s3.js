import S3Client from 'aws-sdk/clients/s3';
import { AWS_ACCESS_KEY, AWS_S3_REGION, AWS_SECRET_ACCESS_KEY } from '../config';

const S3 = new S3Client({
  signatureVersion: 'v4',
  region: AWS_S3_REGION,
  accessKeyId: AWS_ACCESS_KEY, // YOUR AWS ACCESS KEY
  secretAccessKey: AWS_SECRET_ACCESS_KEY, // YOUR AWS SECRET ACCESS KEY
});


export default S3;
