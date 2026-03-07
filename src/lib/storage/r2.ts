import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────
// Client Singleton
// ─────────────────────────────────────────────────────────

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 environment variables are not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)'
    );
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME environment variable is not set');
  }
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) {
    throw new Error('R2_PUBLIC_URL environment variable is not set');
  }
  return url.replace(/\/$/, '');
}

// ─────────────────────────────────────────────────────────
// File path helper
// ─────────────────────────────────────────────────────────

export function buildStoragePath(userId: string, contentId: string, filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${userId}/${year}/${month}/${contentId}/${filename}`;
}

// ─────────────────────────────────────────────────────────
// uploadFile
// ─────────────────────────────────────────────────────────

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const r2Logger = logger.child({ fn: 'r2.uploadFile', key, contentType });
  const start = Date.now();

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `${getPublicUrl()}/${key}`;
    const duration = Date.now() - start;
    r2Logger.info({ duration, size: buffer.length }, 'R2: file uploaded');
    return publicUrl;
  } catch (error) {
    r2Logger.error({ error }, 'R2: upload failed');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// deleteFile
// ─────────────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  const r2Logger = logger.child({ fn: 'r2.deleteFile', key });

  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })
    );
    r2Logger.info('R2: file deleted');
  } catch (error) {
    r2Logger.error({ error }, 'R2: delete failed');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// getSignedUrl
// ─────────────────────────────────────────────────────────

export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const r2Logger = logger.child({ fn: 'r2.getSignedUrl', key, expiresIn });

  try {
    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    const url = await awsGetSignedUrl(getClient(), command, { expiresIn });
    r2Logger.debug({ expiresIn }, 'R2: signed URL generated');
    return url;
  } catch (error) {
    r2Logger.error({ error }, 'R2: failed to generate signed URL');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// extractKeyFromUrl
// ─────────────────────────────────────────────────────────

export function extractKeyFromUrl(url: string): string {
  const publicUrl = getPublicUrl();
  return url.replace(`${publicUrl}/`, '');
}
