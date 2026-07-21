import { IStorageProvider } from './storage.interface';
import { OneDriveStorageProvider } from './onedrive.provider';
import { LocalStorageProvider } from './local.provider';

class StorageServiceFactory {
  private provider: IStorageProvider;

  constructor() {
    if (process.env.STORAGE_PROVIDER === 'onedrive') {
      this.provider = new OneDriveStorageProvider();
    } else {
      this.provider = new LocalStorageProvider();
    }
  }

  getProvider(): IStorageProvider {
    return this.provider;
  }
}

export const storageService = new StorageServiceFactory().getProvider();
