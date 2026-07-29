import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';
import { LocalStorageProvider } from './local.provider';
import { AppError } from '../../lib/errors';
import { logger } from '../../utils/logger';

export class GoogleDriveStorageProvider implements IStorageProvider {
  private localFallback = new LocalStorageProvider();
  private folderIdCache = new Map<string, string>();

  private getCredentials(): Record<string, unknown> | null {
    // 1. Direct JSON string in env
    const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS;
    if (jsonEnv) {
      try {
        const jsonStr = jsonEnv.trim().substring(0, jsonEnv.trim().lastIndexOf('}') + 1);
        return JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        logger.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON from environment variable.');
      }
    }

    // 2. Direct client_email and private_key in env
    if (process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }

    // 3. Fallback to file path if specified
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (envPath && fs.existsSync(envPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(envPath, 'utf8');
      const jsonStr = content.substring(0, content.lastIndexOf('}') + 1);
      return JSON.parse(jsonStr) as Record<string, unknown>;
    }

    const specPath = path.resolve(process.cwd(), '../spec/snappy-mission-503816-n1-7fdd055b8f15.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(specPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(specPath, 'utf8');
      const jsonStr = content.substring(0, content.lastIndexOf('}') + 1);
      return JSON.parse(jsonStr) as Record<string, unknown>;
    }

    const localSpecPath = path.resolve(process.cwd(), 'spec/snappy-mission-503816-n1-7fdd055b8f15.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(localSpecPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(localSpecPath, 'utf8');
      const jsonStr = content.substring(0, content.lastIndexOf('}') + 1);
      return JSON.parse(jsonStr) as Record<string, unknown>;
    }

    return null;
  }

  public hasValidCredentials(): boolean {
    if (process.env.NODE_ENV === 'test') {
      return false;
    }
    return this.getCredentials() !== null;
  }

  private getDriveClient(): drive_v3.Drive {
    const credentials = this.getCredentials();
    if (!credentials) {
      throw new AppError(500, 'STORAGE_CONFIG_ERROR', 'Google Drive service account credentials are not configured.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  }

  private getRootParentId(): string {
    return process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1S3WBt19OTEONmQlvHF-3KdYvio_BAiGt';
  }

  private async ensureFolder(drive: drive_v3.Drive, folderName: string, parentId: string, fullPathKey: string): Promise<string> {
    if (this.folderIdCache.has(fullPathKey)) {
      return this.folderIdCache.get(fullPathKey)!;
    }

    const safeName = folderName.replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const res = await drive.files.list({
      q,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (res.data.files && res.data.files.length > 0) {
      const folderId = res.data.files[0].id!;
      this.folderIdCache.set(fullPathKey, folderId);
      return folderId;
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    const newFolderId = createRes.data.id!;
    this.folderIdCache.set(fullPathKey, newFolderId);
    return newFolderId;
  }

  private async ensureFolderHierarchy(drive: drive_v3.Drive, folderPath: string): Promise<string> {
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
    const segments = cleanPath.split('/').filter(Boolean);

    let currentParentId = this.getRootParentId();
    let currentPathKey = '';

    for (const segment of segments) {
      currentPathKey = currentPathKey ? `${currentPathKey}/${segment}` : segment;
      currentParentId = await this.ensureFolder(drive, segment, currentParentId, currentPathKey);
    }

    return currentParentId;
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    if (!this.hasValidCredentials()) {
      logger.warn('Google Drive credentials missing. Storing certificate in local /uploads fallback.');
      return await this.localFallback.uploadFile(options);
    }

    try {
      const drive = this.getDriveClient();

      let normalizedFolderPath = options.folderPath.replace(/^\/+|\/+$/g, '');
      if (!normalizedFolderPath.startsWith('Certificates')) {
        normalizedFolderPath = `Certificates/${normalizedFolderPath}`;
      }

      const targetFolderId = await this.ensureFolderHierarchy(drive, normalizedFolderPath);

      const response = await drive.files.create({
        requestBody: {
          name: options.fileName,
          parents: [targetFolderId],
        },
        media: {
          mimeType: options.mimeType || 'application/pdf',
          body: Readable.from(options.buffer),
        },
        fields: 'id, webViewLink, webContentLink',
      });

      const fileId = response.data.id!;
      const fileUrl = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

      return {
        fileId,
        fileUrl,
        path: `${normalizedFolderPath}/${options.fileName}`,
      };
    } catch (err: unknown) {
      logger.warn(
        { err: (err as Error)?.message || String(err) },
        'Google Drive API failed. Falling back to local storage.'
      );
      return await this.localFallback.uploadFile(options);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!fileId) return;

    if (!this.hasValidCredentials() || fileId.startsWith('local_') || fileId.startsWith('/uploads/')) {
      await this.localFallback.deleteFile(fileId);
      return;
    }

    try {
      const drive = this.getDriveClient();
      await drive.files.delete({ fileId });
    } catch (err: unknown) {
      logger.warn({ fileId, err: (err as Error)?.message || String(err) }, 'Failed to delete file from Google Drive');
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}
