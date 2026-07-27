import { Client } from '@microsoft/microsoft-graph-client';
import { IStorageProvider, UploadFileOptions, UploadFileResult } from './storage.interface';
import { LocalStorageProvider } from './local.provider';
import { AppError } from '../../lib/errors';
import { logger } from '../../utils/logger';

export class OneDriveStorageProvider implements IStorageProvider {
  private localFallback = new LocalStorageProvider();

  private hasValidCredentials(): boolean {
    const tenantId = process.env.ONEDRIVE_TENANT_ID;
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) return false;
    if (
      tenantId.includes('your-tenant-id') ||
      clientId.includes('your-client-id') ||
      clientSecret.includes('your-client-secret')
    ) {
      return false;
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.hasValidCredentials()) {
      throw new AppError(500, 'STORAGE_CONFIG_ERROR', 'Microsoft OneDrive credentials are not configured or contain placeholder values.');
    }

    const tenantId = process.env.ONEDRIVE_TENANT_ID!;
    const clientId = process.env.ONEDRIVE_CLIENT_ID!;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET!;

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
    if (!this.hasValidCredentials()) {
      logger.warn(
        'Microsoft OneDrive credentials missing or contain placeholders. Automatically storing certificate in local /uploads directory.'
      );
      return await this.localFallback.uploadFile(options);
    }

    try {
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
    } catch (err: unknown) {
      logger.warn(
        { err: (err as Error)?.message || String(err) },
        'Microsoft Graph API unavailable. Silently falling back to local disk storage.'
      );
      return await this.localFallback.uploadFile(options);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const client = await this.getClient();
      const userId = process.env.ONEDRIVE_USER_ID;
      const endpoint = userId ? `/users/${userId}/drive/items/${fileId}` : `/drive/items/${fileId}`;
      await client.api(endpoint).delete();
    } catch (err: unknown) {
      logger.warn({ err: (err as Error)?.message }, 'Microsoft Graph API delete failed, attempting local delete fallback.');
      await this.localFallback.deleteFile(fileId);
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    try {
      const client = await this.getClient();
      const userId = process.env.ONEDRIVE_USER_ID;
      const endpoint = userId ? `/users/${userId}/drive/items/${fileId}` : `/drive/items/${fileId}`;
      const item = await client.api(endpoint).select('@microsoft.graph.downloadUrl,webUrl').get();
      return item['@microsoft.graph.downloadUrl'] || item.webUrl;
    } catch (err: unknown) {
      logger.warn({ err: (err as Error)?.message }, 'Microsoft Graph API getDownloadUrl failed, using local download URL fallback.');
      return await this.localFallback.getDownloadUrl(fileId);
    }
  }
}
