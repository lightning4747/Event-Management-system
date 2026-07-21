import { Client } from '@microsoft/microsoft-graph-client';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';
import { AppError } from '../../lib/errors';

export class OneDriveStorageProvider implements IStorageProvider {
  private async getAccessToken(): Promise<string> {
    const tenantId = process.env.ONEDRIVE_TENANT_ID;
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new AppError(500, 'STORAGE_CONFIG_ERROR', 'Microsoft OneDrive credentials (ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET) are not configured.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError(500, 'ONEDRIVE_AUTH_FAILED', `Failed to authenticate with Microsoft Graph API: ${errText}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  private async getClient(): Promise<Client> {
    const accessToken = await this.getAccessToken();
    return Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
    const client = await this.getClient();
    const userId = process.env.ONEDRIVE_USER_ID;

    // Clean folder path and filename
    const cleanFolderPath = options.folderPath.replace(/^\/+|\/+$/g, '');
    const targetPath = `${cleanFolderPath}/${options.fileName}`;

    // Path format: /users/{userId}/drive/root:/{targetPath}:/content or /drive/root:/{targetPath}:/content
    const uploadEndpoint = userId
      ? `/users/${userId}/drive/root:/${targetPath}:/content`
      : `/drive/root:/${targetPath}:/content`;

    const driveItem = await client.api(uploadEndpoint).put(options.buffer);

    return {
      fileId: driveItem.id,
      fileUrl: driveItem.webUrl || `https://onedrive.live.com/?id=${driveItem.id}`,
      path: targetPath,
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const client = await this.getClient();
    const userId = process.env.ONEDRIVE_USER_ID;
    const endpoint = userId ? `/users/${userId}/drive/items/${fileId}` : `/drive/items/${fileId}`;
    await client.api(endpoint).delete();
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const client = await this.getClient();
    const userId = process.env.ONEDRIVE_USER_ID;
    const endpoint = userId ? `/users/${userId}/drive/items/${fileId}` : `/drive/items/${fileId}`;
    const item = await client.api(endpoint).select('@microsoft.graph.downloadUrl,webUrl').get();
    return item['@microsoft.graph.downloadUrl'] || item.webUrl;
  }
}
