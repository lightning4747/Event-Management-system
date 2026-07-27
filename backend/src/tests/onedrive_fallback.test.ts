/* eslint-disable security/detect-non-literal-fs-filename */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OneDriveStorageProvider } from '../services/storage/onedrive.provider';
import fs from 'fs';
import path from 'path';

describe('OneDrive Storage Fallback Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fall back to local /uploads storage when ONEDRIVE_TENANT_ID is placeholder', async () => {
    process.env.STORAGE_PROVIDER = 'onedrive';
    process.env.ONEDRIVE_TENANT_ID = 'your-tenant-id-here';
    process.env.ONEDRIVE_CLIENT_ID = 'your-client-id-here';
    process.env.ONEDRIVE_CLIENT_SECRET = 'your-client-secret-here';

    const provider = new OneDriveStorageProvider();
    const result = await provider.uploadFile({
      fileName: 'test_fallback_cert.pdf',
      folderPath: 'Certificates/Third Year/A',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock pdf content'),
    });

    expect(result.fileUrl).toContain('/uploads/Certificates/Third Year/A/test_fallback_cert.pdf');
    expect(result.fileId).toBe('Certificates/Third Year/A/test_fallback_cert.pdf');

    // Clean up created test file
    const localFilePath = path.join(process.cwd(), 'uploads', result.fileId);
    if (fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath);
    }
  });

  it('should fall back to local /uploads storage when OneDrive credentials are completely missing', async () => {
    delete process.env.ONEDRIVE_TENANT_ID;
    delete process.env.ONEDRIVE_CLIENT_ID;
    delete process.env.ONEDRIVE_CLIENT_SECRET;

    const provider = new OneDriveStorageProvider();
    const result = await provider.uploadFile({
      fileName: 'test_missing_creds_cert.pdf',
      folderPath: 'Certificates/Second Year/B',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock pdf content'),
    });

    expect(result.fileUrl).toContain('/uploads/Certificates/Second Year/B/test_missing_creds_cert.pdf');

    // Clean up created test file
    const localFilePath = path.join(process.cwd(), 'uploads', result.fileId);
    if (fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath);
    }
  });
});
