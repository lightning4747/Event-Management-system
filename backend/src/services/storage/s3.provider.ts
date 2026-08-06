import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';
import { AppError } from '../../lib/errors';
import { logger } from '../../utils/logger';

export class S3StorageProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const bucket = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;

    if (!region || !bucket) {
      throw new AppError(
        500,
        'STORAGE_CONFIG_ERROR',
        'AWS_REGION and S3_BUCKET_NAME (or AWS_S3_BUCKET) environment variables are required for S3 storage.'
      );
    }

    this.bucket = bucket;
    // AWS SDK v3 automatically reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
    this.client = new S3Client({ region });
  }

  async uploadFile(opts: UploadFileOptions): Promise<UploadFileResult> {
    // Combine folderPath + fileName to form the final S3 object key
    const key = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: opts.buffer,
          ContentType: opts.mimeType || 'application/octet-stream',
          // Never set ACL — bucket must block public access
        })
      );

      // fileUrl is a backend-proxied path; the frontend never gets raw S3 URLs
      const fileUrl = `/api/files/${encodeURIComponent(key)}`;

      return {
        fileId: key,  // S3 object key stored in drive_item_id column
        fileUrl,
        path: key,
      };
    } catch (err: unknown) {
      logger.error(
        { key, err: (err as Error)?.message || String(err) },
        'S3 upload failed'
      );
      throw new AppError(500, 'STORAGE_UPLOAD_ERROR', 'File upload to S3 failed. Please try again.');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!fileId) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: fileId })
      );
    } catch (err: unknown) {
      // Log but do not throw — deletion failures should not block user workflows
      logger.warn(
        { fileId, err: (err as Error)?.message || String(err) },
        'S3 delete failed — orphaned object may remain'
      );
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: fileId });
    // Pre-signed URL valid for 1 hour
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}
