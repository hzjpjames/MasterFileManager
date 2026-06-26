import { NativeModules, NativeEventEmitter } from 'react-native';

const { USBModule } = NativeModules;

export interface USBVolume {
  path: string;
  name?: string;
  uuid?: string;
  displayName: string;
  totalSize: number;
  freeSize: number;
  mounted?: boolean;
  removable?: boolean;
}

class USBService {
  private emitter = new NativeEventEmitter(USBModule);

  async showToast(msg: string): Promise<boolean> {
    try { return await USBModule.showToast(msg); } catch { return false; }
  }

  /**
   * Scan all external volumes (SD cards, USB OTG devices)
   */
  async scanVolumes(): Promise<USBVolume[]> {
    try {
      const volumes = await USBModule.scanVolumes();
      return volumes || [];
    } catch (e) {
      console.error('[USBService] scanVolumes error:', e);
      return [];
    }
  }

  /**
   * Get filesystem info for a path
   */
  async getVolumeInfo(path: string): Promise<{ totalSize: number; freeSize: number; usedSize: number } | null> {
    try {
      return await USBModule.getVolumeInfo(path);
    } catch (e) {
      console.error('[USBService] getVolumeInfo error:', e);
      return null;
    }
  }

  /**
   * Listen for USB mount/unmount events
   */
  async debugStorageInfo(): Promise<string> {
    try {
      return await USBModule.debugStorageInfo();
    } catch (e) {
      console.error('[USBService] debugStorageInfo error:', e);
      return 'Error: ' + e;
    }
  }

  onUSBStateChanged(callback: (event: { type: 'mounted' | 'unmounted'; path?: string }) => void) {
    return this.emitter.addListener('USB_STATE_CHANGED', callback);
  }

  /**
   * Launch system file picker to grant OTG/USB access via SAF.
   * Promise-based: resolves with the granted URI string, or empty string if cancelled.
   */
  async requestOTGAccess(): Promise<string> {
    try {
      const uri = await USBModule.requestOTGAccess();
      return uri || '';
    } catch (e) {
      console.error('[USBService] requestOTGAccess error:', e);
      return '';
    }
  }

  /**
   * List directory using DocumentFile API (SAF).
   */
  async listOTGDirectory(uri: string, path: string): Promise<any[]> {
    try {
      const items = await USBModule.listOTGDirectory(uri, path);
      return items || [];
    } catch (e) {
      console.error('[USBService] listOTGDirectory error:', e);
      throw e;
    }
  }

  /**
   * Store the granted SAF URI for persistent access.
   */
  async setOTGUri(uri: string): Promise<boolean> {
    try {
      return await USBModule.setOTGUri(uri);
    } catch (e) {
      console.error('[USBService] setOTGUri error:', e);
      return false;
    }
  }

  /**
   * Get the stored OTG URI.
   */
  async getOTGUri(): Promise<string> {
    try {
      return await USBModule.getOTGUri() || '';
    } catch (e) {
      console.error('[USBService] getOTGUri error:', e);
      return '';
    }
  }

  /**
   * Check if the OTG URI is still valid.
   */
  async isUriValid(uri: string): Promise<boolean> {
    try {
      return await USBModule.checkUriValidity(uri) || false;
    } catch (e) {
      console.error('[USBService] isUriValid error:', e);
      return false;
    }
  }

  /**
   * Create a folder on OTG via SAF.
   */
  async createOTGFolder(uri: string, relativePath: string, folderName: string): Promise<boolean> {
    try {
      console.log('[USBService.createOTGFolder] uri:', uri, 'relativePath:', relativePath, 'folderName:', folderName);
      return await USBModule.createOTGFolder(uri, relativePath, folderName);
    } catch (e) {
      console.error('[USBService] createOTGFolder error:', e);
      throw e;
    }
  }

  /**
   * Create a file on OTG via SAF.
   */
  async createOTGFile(uri: string, relativePath: string, fileName: string, mimeType: string): Promise<boolean> {
    try {
      console.log('[USBService.createOTGFile] uri:', uri, 'relativePath:', relativePath, 'fileName:', fileName, 'mimeType:', mimeType);
      return await USBModule.createOTGFile(uri, relativePath, fileName, mimeType);
    } catch (e) {
      console.error('[USBService] createOTGFile error:', e);
      throw e;
    }
  }

  /**
   * Delete a file/folder on OTG via SAF.
   */
  async deleteOTGItem(uri: string, relativePath: string, itemName: string): Promise<boolean> {
    try {
      console.log('[USBService.deleteOTGItem] uri:', uri, 'relativePath:', relativePath, 'itemName:', itemName);
      return await USBModule.deleteOTGItem(uri, relativePath, itemName);
    } catch (e) {
      console.error('[USBService] deleteOTGItem error:', e);
      throw e;
    }
  }

  /**
   * Rename a file/folder on OTG via SAF.
   */
  async renameOTGItem(uri: string, relativePath: string, oldName: string, newName: string): Promise<boolean> {
    try {
      console.log('[USBService.renameOTGItem] uri:', uri, 'relativePath:', relativePath, 'oldName:', oldName, 'newName:', newName);
      return await USBModule.renameOTGItem(uri, relativePath, oldName, newName);
    } catch (e) {
      console.error('[USBService] renameOTGItem error:', e);
      throw e;
    }
  }

  /**
   * Check if an item exists on OTG via SAF.
   */
  async existsOTGItem(uri: string, relativePath: string, itemName: string): Promise<boolean> {
    try {
      console.log('[USBService.existsOTGItem] uri:', uri, 'relativePath:', relativePath, 'itemName:', itemName);
      return await USBModule.existsOTGItem(uri, relativePath, itemName);
    } catch (e) {
      return false;
    }
  }

  /**
   * Copy a file from OTG to local storage.
   */
  async copyOTGToLocal(uri: string, relativePath: string, fileName: string, destLocalPath: string): Promise<boolean> {
    try {
      console.log('[USBService.copyOTGToLocal] uri:', uri, 'relativePath:', relativePath, 'fileName:', fileName, 'destLocalPath:', destLocalPath);
      return await USBModule.copyOTGToLocal(uri, relativePath, fileName, destLocalPath);
    } catch (e) {
      console.error('[USBService] copyOTGToLocal error:', e);
      throw e;
    }
  }

  /**
   * Copy a local file to OTG.
   */
  async copyLocalToOTG(uri: string, relativePath: string, localPath: string, destFileName: string, mimeType: string): Promise<boolean> {
    try {
      console.log('[USBService.copyLocalToOTG] uri:', uri, 'relativePath:', relativePath, 'localPath:', localPath, 'destFileName:', destFileName, 'mimeType:', mimeType);
      return await USBModule.copyLocalToOTG(uri, relativePath, localPath, destFileName, mimeType);
    } catch (e) {
      console.error('[USBService] copyLocalToOTG error:', e);
      throw e;
    }
  }

  /**
   * Helper: extract the relative path from an OTG path.
   * e.g. '/mnt/media_rw/B4FE-5315/Photos/2024' → '/Photos/2024'
   * or '/otg/Photos/2024' → '/Photos/2024'
   * or 'otg:/Photos/2024' → '/Photos/2024'
   */
  extractOTGRelativePath(fullPath: string): string {
      // Handle root /otg/ path (just the mount point, no subfolder)
      if (fullPath === '/otg/' || fullPath === '/otg') return '/';
    // Handle /mnt/media_rw/UUID/... paths
    const mntMatch = fullPath.match(/^\/mnt\/media_rw\/[^\/]+\/(.*)/);
    if (mntMatch) return '/' + mntMatch[1];
    // Handle /otg/... paths (from listOTGDirectory)
    const otgMatch = fullPath.match(/^\/otg\/(.*)/);
    if (otgMatch) return '/' + otgMatch[1];
    // Handle otg:/... paths (some devices)
    const otgColonMatch = fullPath.match(/^otg:\/(.*)/);
    if (otgColonMatch) return '/' + otgColonMatch[1];
    // Handle content:// SAF URI paths — treat as root
    if (fullPath.startsWith('content://')) return '/';
    // Handle paths that are already relative (after the mount point)
    const lastDir = fullPath.substring(fullPath.lastIndexOf('/') + 1);
    return fullPath.includes('/') ? fullPath : '/' + fullPath;
  }
}

export default new USBService();
