import fs from 'fs';
import path from 'path';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    const targetFolder = path.join(this.baseDir, options.folderPath);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const filePath = path.join(targetFolder, options.fileName);
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
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    return `/uploads/${fileId}`;
  }
}
