import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleDriveStorageProvider } from '../services/storage/gdrive.provider';
import fs from 'fs';
import path from 'path';

describe('Google Drive Storage Fallback Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fall back to local /uploads storage when Google Drive credentials are absent or invalid', async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const provider = new GoogleDriveStorageProvider();

    const sampleBuffer = Buffer.from('PDF_TEST_DATA');
    const result = await provider.uploadFile({
      fileName: 'test_cert_fallback.pdf',
      folderPath: 'Certificates/Third Year/A/727624BAD001/Cocurricular/General',
      mimeType: 'application/pdf',
      buffer: sampleBuffer,
    });

    expect(result).toBeDefined();
    expect(result.fileUrl).toContain('/uploads/');
    expect(result.fileId).toBeDefined();

    const expectedLocalPath = path.resolve(process.cwd(), result.fileUrl.replace(/^\//, ''));
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    expect(fs.existsSync(expectedLocalPath)).toBe(true);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(expectedLocalPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(expectedLocalPath);
    }
  });

  it('should generate valid Google Drive download URLs when fileId is set', async () => {
    const provider = new GoogleDriveStorageProvider();
    const downloadUrl = await provider.getDownloadUrl('1ABC_XYZ_TEST_FILE_ID');
    expect(downloadUrl).toBe('https://drive.google.com/file/d/1ABC_XYZ_TEST_FILE_ID/view');
  });
});
