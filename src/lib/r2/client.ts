import { S3Client } from "@aws-sdk/client-s3";

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 environment variables");
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _r2Client;
}


export const R2_BUCKET = process.env.R2_BUCKET || "overwatch-sparkles-demos";
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const GLOBAL_STORAGE_CAP = 10 * 1024 * 1024 * 1024; // 10GB
