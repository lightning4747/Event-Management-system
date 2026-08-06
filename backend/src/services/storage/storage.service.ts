import { IStorageProvider } from './storage.interface';
import { S3StorageProvider } from './s3.provider';
import { LocalStorageProvider } from './local.provider';

class StorageServiceFactory {
  private provider: IStorageProvider;

  constructor() {
    const providerType = process.env.STORAGE_PROVIDER || 's3';
    if (providerType === 'local') {
      this.provider = new LocalStorageProvider();
    } else {
      // Default to S3 for all non-local environments
      this.provider = new S3StorageProvider();
    }
  }

  getProvider(): IStorageProvider {
    return this.provider;
  }
}

export const storageService = new StorageServiceFactory().getProvider();

