export interface UploadFileOptions {
  fileName: string;
  folderPath: string; // e.g. "Certificates/Third Year/A"
  mimeType: string;
  buffer: Buffer;
}

export interface UploadFileResult {
  fileId: string;      // Storage item ID (driveItemId or S3 key or local relative path)
  fileUrl: string;     // Web viewable URL / API URL
  downloadUrl?: string;
  path: string;
}

export interface IStorageProvider {
  uploadFile(options: UploadFileOptions): Promise<UploadFileResult>;
  deleteFile(fileId: string): Promise<void>;
  getDownloadUrl(fileId: string): Promise<string>;
}
