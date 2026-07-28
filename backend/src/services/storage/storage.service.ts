import { IStorageProvider } from './storage.interface';
import { GoogleDriveStorageProvider } from './gdrive.provider';
import { LocalStorageProvider } from './local.provider';

class StorageServiceFactory {
  private provider: IStorageProvider;

  constructor() {
    const providerType = process.env.STORAGE_PROVIDER || 'gdrive';
    if (providerType === 'local') {
      this.provider = new LocalStorageProvider();
    } else {
      this.provider = new GoogleDriveStorageProvider();
    }
  }

  getProvider(): IStorageProvider {
    return this.provider;
  }
}

export const storageService = new StorageServiceFactory().getProvider();
