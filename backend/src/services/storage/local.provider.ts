import fs from 'fs';
import path from 'path';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'uploads');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(this.baseDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    const targetFolder = path.join(this.baseDir, options.folderPath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(targetFolder)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const filePath = path.join(targetFolder, options.fileName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.promises.writeFile(filePath, options.buffer);

    const relativePath = path.relative(this.baseDir, filePath);
    const fileId = relativePath.replace(/\\/g, '/');
    const fileUrl = `/uploads/${fileId}`;

    return {
      fileId,
      fileUrl,
      path: relativePath,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const filePath = path.join(this.baseDir, fileId);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(filePath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.promises.unlink(filePath);
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return `/uploads/${fileId}`;
  }
}
