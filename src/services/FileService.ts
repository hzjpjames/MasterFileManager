import { 
  FileItem, 
  FileType, 
  FileProperties, 
  SortOptions, 
  SearchOptions,
  CategoryStats 
} from '../types';
import { 
  getFileType, 
  getFileExtension, 
  formatFileSize, 
  formatDate 
} from '../utils/fileUtils';
import RNFS from 'react-native-fs';
import SMBService from './SMBService';
import USBService from './USBService';

/**
 * 文件服务 - 处理所有文件系统操作
 */
class FileService {
  /** 全局剪贴板（跨屏幕持久化，解决 SMB → 本地复制时状态丢失） */
  globalClipboard: { items: FileItem[]; operation: 'copy' | 'cut' } | null = null;

  /** 判断是否为 OTG/USB 路径（支持所有格式） */
  private isOTGPath(path: string): boolean {
    return path.startsWith('/mnt/media_rw/') || path.startsWith('/otg/') || path.startsWith('otg:/') || path.startsWith('content://');
  }
  /**
   * 获取存储路径列表
   */
  async getStoragePaths(): Promise<string[]> {
    const paths: string[] = [];
    
    // 内部存储
    paths.push(RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0');
    
    // 外部SD卡（如果存在）
    try {
      const externalDirs = RNFS.ExternalDirectoryPath;
      if (externalDirs && !paths.includes(externalDirs)) {
        paths.push(externalDirs);
      }
    } catch (e) {
      // 外部存储不存在
    }
    
    return paths;
  }

  /**
   * 列出目录内容
   */
  async listDirectory(
    path: string, 
    sortOptions?: SortOptions
  ): Promise<FileItem[]> {
    try {
      // SMB paths use native module
      if (path.startsWith('smb://')) {
        const items = await SMBService.listDirectoryByUrl(path);
        if (sortOptions) {
          return this.sortFiles(items, sortOptions);
        }
        return this.sortFiles(items, {
          sortBy: 'name' as any,
          sortOrder: 'asc' as any,
          foldersFirst: true,
        });
      }

      // OTG paths (all formats: /mnt/media_rw/, /otg/, otg:/, content://)
      if (this.isOTGPath(path)) {
        const otgUri = await USBService.getOTGUri();
        if (!otgUri) {
          throw new Error('OTG access not granted. Please tap the USB device card to authorize access.');
        }
        const relativePath = USBService.extractOTGRelativePath(path);
        const rawItems = await USBService.listOTGDirectory(otgUri, relativePath);
        let fileItems: FileItem[] = rawItems.map((item: any) => ({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory,
          size: item.size || 0,
          modifiedTime: item.modifiedTime || 0,
          type: item.type || (item.isDirectory ? 'directory' : 'file'),
          extension: item.extension || undefined,
        }));
        if (sortOptions) {
          return this.sortFiles(fileItems, sortOptions);
        }
        return this.sortFiles(fileItems, {
          sortBy: 'name' as any,
          sortOrder: 'asc' as any,
          foldersFirst: true,
        });
      }

      const exists = await RNFS.exists(path);
      if (!exists) {
        throw new Error('Directory does not exist');
      }

      const items = await RNFS.readDir(path);
      let fileItems: FileItem[] = items.map(item => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory(),
        size: item.size || 0,
        modifiedTime: item.mtime || 0,
        type: getFileType(item.name, item.isDirectory()),
        extension: item.isFile() ? getFileExtension(item.name) : undefined,
      }));

      // 排序
      if (sortOptions) {
        fileItems = this.sortFiles(fileItems, sortOptions);
      } else {
        // 默认排序：文件夹优先，然后按名称
        fileItems = this.sortFiles(fileItems, {
          sortBy: 'name' as any,
          sortOrder: 'asc' as any,
          foldersFirst: true,
        });
      }

      return fileItems;
    } catch (error) {
      console.error('列出目录失败:', error);
      throw error;
    }
  }

  /**
   * 排序文件列表
   */
  private sortFiles(files: FileItem[], options: SortOptions): FileItem[] {
    return files.sort((a, b) => {
      // 文件夹优先
      if (options.foldersFirst) {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
      }

      let comparison = 0;
      switch (options.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = a.modifiedTime - b.modifiedTime;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return options.sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 创建文件夹
   */
  async createFolder(path: string, name: string): Promise<boolean> {
    try {
      const fullPath = `${path}/${name}`;

      // SMB 路径走原生模块
      if (path.startsWith('smb://')) {
        return await SMBService.createDirectory(fullPath);
      }

      // OTG 路径走 SAF
      if (this.isOTGPath(path)) {
        const otgUri = await USBService.getOTGUri();
        console.log('[FileService.createFolder] OTG path detected, uri:', otgUri, 'path:', path);
        const relativePath = USBService.extractOTGRelativePath(path);
        console.log('[FileService.createFolder] relativePath:', relativePath, 'name:', name);
        return await USBService.createOTGFolder(otgUri, relativePath, name);
      }

      const exists = await RNFS.exists(fullPath);
      if (exists) {
        throw new Error('文件夹已存在');
      }
      await RNFS.mkdir(fullPath);
      return true;
    } catch (error) {
      console.error('创建文件夹失败:', error);
      throw error;
    }
  }

  /**
   * 创建文件
   */
  async createFile(path: string, name: string, content: string = ''): Promise<boolean> {
    try {
      const fullPath = `${path}/${name}`;

      // SMB 路径走原生模块
      if (path.startsWith('smb://')) {
        return await SMBService.createFile(fullPath);
      }

      // OTG 路径走 SAF
      if (this.isOTGPath(path)) {
        const otgUri = await USBService.getOTGUri();
        console.log('[FileService.createFile] OTG path detected, uri:', otgUri, 'path:', path);
        const relativePath = USBService.extractOTGRelativePath(path);
        const ext = (name.split('.').pop() || '').toLowerCase();
        const mime = this.getMimeType(name);
        console.log('[FileService.createFile] relativePath:', relativePath, 'name:', name, 'mime:', mime);
        return await USBService.createOTGFile(otgUri, relativePath, name, mime);
      }

      const exists = await RNFS.exists(fullPath);
      if (exists) {
        throw new Error('文件已存在');
      }
      await RNFS.writeFile(fullPath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('创建文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件或文件夹
   */
  async delete(path: string): Promise<boolean> {
    try {
      // OTG 路径走 SAF
      if (this.isOTGPath(path)) {
        const otgUri = await USBService.getOTGUri();
        console.log('[FileService.delete] OTG path detected, uri:', otgUri, 'path:', path);
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const itemName = path.substring(path.lastIndexOf('/') + 1);
        const relativePath = USBService.extractOTGRelativePath(parentPath);
        console.log('[FileService.delete] Calling USBService.deleteOTGItem, relativePath:', relativePath, 'itemName:', itemName);
        return await USBService.deleteOTGItem(otgUri, relativePath, itemName);
      }

      const exists = await RNFS.exists(path);
      if (!exists) {
        throw new Error('文件不存在');
      }
      await RNFS.unlink(path);
      return true;
    } catch (error) {
      console.error('删除失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除
   */
  async deleteMultiple(paths: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const path of paths) {
      try {
        await this.delete(path);
        success++;
      } catch (e) {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 重命名文件或文件夹
   */
  /**
   * 提取文件名（去除路径尾部 /）
   */
  private getFileName(path: string): string {
    const clean = path.replace(/\/+$/, '');
    return clean.substring(clean.lastIndexOf('/') + 1);
  }

  async rename(oldPath: string, newName: string): Promise<boolean> {
    try {
      // SMB 路径走原生 rename
      if (oldPath.startsWith('smb://')) {
        return await SMBService.rename(oldPath, newName);
      }

      // OTG 路径走 SAF
      if (this.isOTGPath(oldPath)) {
        const otgUri = await USBService.getOTGUri();
        console.log('[FileService.rename] OTG path detected, uri:', otgUri, 'oldPath:', oldPath);
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const oldName = oldPath.substring(oldPath.lastIndexOf('/') + 1);
        const relativePath = USBService.extractOTGRelativePath(parentPath);
        console.log('[FileService.rename] Calling USBService.renameOTGItem, relativePath:', relativePath, 'oldName:', oldName, 'newName:', newName);
        return await USBService.renameOTGItem(otgUri, relativePath, oldName, newName);
      }

      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parentPath}/${newName}`;
      
      const exists = await RNFS.exists(newPath);
      if (exists) {
        throw new Error('目标名称已存在');
      }

      await RNFS.moveFile(oldPath, newPath);
      return true;
    } catch (error) {
      console.error('重命名失败:', error);
      throw error;
    }
  }

  /**
   * 复制文件或文件夹
   */
  async copy(source: string, destination: string, overwrite: boolean = false): Promise<boolean> {
    try {
      const fileName = this.getFileName(source);
      const destPath = `${destination.replace(/\/+$/, '')}/${fileName}`;

      const destIsSmb = destination.startsWith('smb://');
      const srcIsSmb = source.startsWith('smb://');
      const srcIsOtg = this.isOTGPath(source);
      const destIsOtg = this.isOTGPath(destination);

      // OTG → OTG: download to temp then upload
      if (srcIsOtg && destIsOtg) {
        console.log('[FileService.copy] OTG→OTG, source:', source, 'dest:', destPath);
        return await this.copyOtgToOtg(source, destPath);
      }

      // OTG → 本地
      if (srcIsOtg) {
        console.log('[FileService.copy] OTG→Local, source:', source, 'dest:', destPath);
        return await this.copyFromOtg(source, destPath);
      }

      // 本地 → OTG
      if (destIsOtg) {
        console.log('[FileService.copy] Local→OTG, source:', source, 'dest:', destPath);
        return await this.copyToOtg(source, destPath);
      }

      // 目标存在性检查（SMB 目标跳过本地检查）
      if (!destIsSmb) {
        const destExists = await RNFS.exists(destPath);
        if (destExists && !overwrite) {
          throw new Error('目标位置已存在同名文件');
        }
        if (destExists && overwrite) {
          const stat = await RNFS.stat(destPath);
          if (stat.isDirectory()) {
            await RNFS.unlink(destPath);
          } else {
            await RNFS.unlink(destPath);
          }
        }
      }

      // SMB → SMB：下载到临时 → 上传
      if (srcIsSmb && destIsSmb) {
        return await this.copySmbToSmb(source, destPath, source.endsWith('/'));
      }

      // SMB → 本地
      if (srcIsSmb) {
        const isDir = source.endsWith('/');
        if (isDir) {
          return await this.copyFromSMBFolder(source, destPath);
        }
        return await this.copyFromSMBFile(source, destPath);
      }

      // 本地 → SMB
      if (destIsSmb) {
        return await this.copyToSmb(source, destPath);
      }

      // 本地 → 本地
      const stat = await RNFS.stat(source);
      if (stat.isDirectory()) {
        await this.copyFolder(source, destPath);
      } else {
        await RNFS.copyFile(source, destPath);
      }
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      throw error;
    }
  }

  /**
   * 从 SMB 共享复制文件到本地
   */
  private async copyFromSMBFile(smbSource: string, destPath: string): Promise<boolean> {
    try {
      const tempDir = RNFS.CachesDirectoryPath;
      const fileName = this.getFileName(smbSource);
      const tempPath = `${tempDir}/${fileName}`;

      await SMBService.downloadFileByUrl(smbSource, tempPath);
      await RNFS.copyFile(tempPath, destPath);

      // 清理临时文件
      try { await RNFS.unlink(tempPath); } catch (e) {}

      return true;
    } catch (error: any) {
      throw new Error(`SMB复制失败: ${error.message}`);
    }
  }

  /**
   * 递归复制 SMB 文件夹到本地
   */
  private async copyFromSMBFolder(smbSource: string, destPath: string): Promise<boolean> {
    try {
      await RNFS.mkdir(destPath);
      const items = await SMBService.listDirectoryByUrl(smbSource);

      for (const item of items) {
        const srcPath = item.path;
        const dstPath = `${destPath}/${item.name}`;

        if (item.isDirectory) {
          await this.copyFromSMBFolder(srcPath, dstPath);
        } else {
          const tempPath = `${RNFS.CachesDirectoryPath}/smb_copy_${Date.now()}_${item.name}`;
          await SMBService.downloadFileByUrl(srcPath, tempPath);
          await RNFS.copyFile(tempPath, dstPath);
          try { await RNFS.unlink(tempPath); } catch (e) {}
        }
      }
      return true;
    } catch (error: any) {
      throw new Error(`SMB文件夹复制失败: ${error.message}`);
    }
  }

  /**
   * 本地路径 → SMB 上传
   */
  private async copyToSmb(source: string, destPath: string): Promise<boolean> {
    try {
      const stat = await RNFS.stat(source);
      if (stat.isDirectory()) {
        const items = await RNFS.readDir(source);
        for (const item of items) {
          const srcPath = item.path;
          const dstPath = `${destPath}/${item.name}`;
          if (item.isDirectory()) {
            await this.copyToSmb(srcPath, dstPath);
          } else {
            await SMBService.uploadFileByUrl(srcPath, dstPath);
          }
        }
      } else {
        await SMBService.uploadFileByUrl(source, destPath);
      }
      return true;
    } catch (error: any) {
      throw new Error(`上传到SMB失败: ${error.message}`);
    }
  }

  /**
   * SMB → SMB 复制（走本地临时文件中转）
   */
  private async copySmbToSmb(source: string, destPath: string, isDir: boolean): Promise<boolean> {
    try {
      const tempRoot = `${RNFS.CachesDirectoryPath}/smb2smb_${Date.now()}`;
      if (isDir) {
        // 递归下载到临时目录
        await this.copyFromSMBFolder(source, tempRoot);
        // 上传到目标 SMB
        const items = await RNFS.readDir(tempRoot);
        for (const item of items) {
          const dstItemPath = `${destPath}/${item.name}`;
          if (item.isDirectory()) {
            await this.copyToSmb(item.path, dstItemPath);
          } else {
            await SMBService.uploadFileByUrl(item.path, dstItemPath);
          }
        }
      } else {
        const tempFile = `${tempRoot}_file`;
        await this.copyFromSMBFile(source, tempFile);
        await SMBService.uploadFileByUrl(tempFile, destPath);
        try { await RNFS.unlink(tempFile); } catch (e) {}
      }
      // 清理临时文件
      try { await RNFS.unlink(tempRoot); } catch (e) {}
      return true;
    } catch (error: any) {
      throw new Error(`SMB→SMB复制失败: ${error.message}`);
    }
  }

  /**
   * 递归复制文件夹
   */
  private async copyFolder(source: string, destination: string): Promise<void> {
    await RNFS.mkdir(destination);
    const items = await RNFS.readDir(source);
    
    for (const item of items) {
      if (item.isDirectory()) {
        await this.copyFolder(item.path, `${destination}/${item.name}`);
      } else {
        await RNFS.copyFile(item.path, `${destination}/${item.name}`);
      }
    }
  }

  /**
   * 从 OTG 复制文件到本地
   */
  private async copyFromOtg(source: string, destPath: string): Promise<boolean> {
    try {
      const otgUri = await USBService.getOTGUri();
      const fileName = this.getFileName(source);
      const parentPath = source.substring(0, source.lastIndexOf('/'));
      const relativePath = USBService.extractOTGRelativePath(parentPath);
      
      // 判断源是文件还是文件夹 — OTG 路径末尾无 / 视为文件
      // 使用 listOTGDirectory 检查
      try {
        const items = await USBService.listOTGDirectory(otgUri, relativePath);
        const sourceItem = items.find((i: any) => i.name === fileName);
        if (sourceItem && sourceItem.isDirectory) {
          // 文件夹：递归复制
          await RNFS.mkdir(destPath);
          const subRelativePath = relativePath === '/' ? '/' + fileName : relativePath + '/' + fileName;
          const subItems = await USBService.listOTGDirectory(otgUri, subRelativePath);
          for (const item of subItems) {
            const subSrc = source + '/' + item.name;
            const subDst = destPath + '/' + item.name;
            if (item.isDirectory) {
              await this.copyFromOtg(subSrc, subDst);
            } else {
              await USBService.copyOTGToLocal(otgUri, subRelativePath, item.name, subDst);
            }
          }
          return true;
        }
      } catch (e) {
        // ignore, treat as file
      }
      
      // 单文件复制
      await USBService.copyOTGToLocal(otgUri, relativePath, fileName, destPath);
      return true;
    } catch (error: any) {
      throw new Error(`OTG复制失败: ${error.message}`);
    }
  }

  /**
   * 从本地复制文件到 OTG
   */
  private async copyToOtg(source: string, destPath: string): Promise<boolean> {
    try {
      const otgUri = await USBService.getOTGUri();
      const fileName = this.getFileName(source);
      const destParentPath = destPath.substring(0, destPath.lastIndexOf('/'));
      const relativePath = USBService.extractOTGRelativePath(destParentPath);
      const mime = this.getMimeType(fileName);
      
      const stat = await RNFS.stat(source);
      if (stat.isDirectory()) {
        // 文件夹：先在OTG创建文件夹，再递归复制
        await USBService.createOTGFolder(otgUri, relativePath, fileName);
        const newRelativePath = relativePath === '/' ? '/' + fileName : relativePath + '/' + fileName;
        const items = await RNFS.readDir(source);
        for (const item of items) {
          const subSrc = item.path;
          const subDst = destPath + '/' + item.name;
          await this.copyToOtg(subSrc, subDst);
        }
      } else {
        await USBService.copyLocalToOTG(otgUri, relativePath, source, fileName, mime);
      }
      return true;
    } catch (error: any) {
      throw new Error(`复制到OTG失败: ${error.message}`);
    }
  }

  /**
   * OTG → OTG 复制（走本地临时文件中转）
   */
  private async copyOtgToOtg(source: string, destPath: string): Promise<boolean> {
    try {
      const tempDir = `${RNFS.CachesDirectoryPath}/otg2otg_${Date.now()}`;
      // 先下载到临时目录
      await this.copyFromOtg(source, tempDir);
      // 再上传到目标 OTG
      await this.copyToOtg(tempDir, destPath);
      // 清理临时文件
      try { await RNFS.unlink(tempDir); } catch (e) {}
      return true;
    } catch (error: any) {
      throw new Error(`OTG→OTG复制失败: ${error.message}`);
    }
  }

  /**
   * 移动文件或文件夹
   */
  async move(source: string, destination: string, overwrite: boolean = false): Promise<boolean> {
    try {
      const fileName = this.getFileName(source);
      const destPath = `${destination.replace(/\/+$/, '')}/${fileName}`;
      
      const destExists = await RNFS.exists(destPath);
      if (destExists && !overwrite) {
        throw new Error('目标位置已存在同名文件');
      }
      if (destExists && overwrite) {
        try { await RNFS.unlink(destPath); } catch (e) {}
      }

      await RNFS.moveFile(source, destPath);
      return true;
    } catch (error) {
      console.error('移动失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件属性
   */
  async getProperties(path: string): Promise<FileProperties> {
    try {
      const stat = await RNFS.stat(path);
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      
      return {
        name: fileName,
        path: path,
        type: stat.isDirectory() ? '文件夹' : getFileExtension(fileName),
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        createdTime: stat.ctime || 0,
        modifiedTime: stat.mtime || 0,
        accessedTime: stat.atime || 0,
        isDirectory: stat.isDirectory(),
        isHidden: fileName.startsWith('.'),
        isReadOnly: false, // RNFS不直接支持权限检查
        permissions: '',
        extension: stat.isFile() ? getFileExtension(fileName) : undefined,
        mimeType: stat.isFile() ? this.getMimeType(fileName) : undefined,
      };
    } catch (error) {
      console.error('获取属性失败:', error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async search(
    path: string, 
    options: SearchOptions,
    onProgress?: (results: FileItem[]) => void
  ): Promise<FileItem[]> {
    const results: FileItem[] = [];
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();

    await this.searchRecursive(path, query, options, results, onProgress);
    
    return results;
  }

  /**
   * 递归搜索
   */
  private async searchRecursive(
    path: string,
    query: string,
    options: SearchOptions,
    results: FileItem[],
    onProgress?: (results: FileItem[]) => void
  ): Promise<void> {
    try {
      const items = await RNFS.readDir(path);
      
      for (const item of items) {
        const name = options.caseSensitive ? item.name : item.name.toLowerCase();
        
        if (name.includes(query)) {
          const fileType = getFileType(item.name, item.isDirectory());
          // 如果有文件类型筛选，只保留匹配的文件（文件夹始终保留）
          if (!options.fileTypes || options.fileTypes.length === 0 || item.isDirectory() || options.fileTypes.includes(fileType)) {
            results.push({
              name: item.name,
              path: item.path,
              isDirectory: item.isDirectory(),
              size: item.size || 0,
              modifiedTime: item.mtime || 0,
              type: fileType,
              extension: item.isFile() ? getFileExtension(item.name) : undefined,
            });
            
            if (onProgress) {
              onProgress([...results]);
            }
          }
        }
        
        if (item.isDirectory() && options.searchRecursively) {
          await this.searchRecursive(item.path, query, options, results, onProgress);
        }
      }
    } catch (e) {
      // 忽略无权限访问的目录
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats(path: string): Promise<CategoryStats> {
    const stats: CategoryStats = {
      images: 0,
      videos: 0,
      music: 0,
      documents: 0,
      apks: 0,
      archives: 0,
      others: 0,
      total: 0,
      totalSize: 0,
    };

    await this.countFilesRecursive(path, stats);
    
    return stats;
  }

  /**
   * 递归统计文件
   */
  private async countFilesRecursive(path: string, stats: CategoryStats): Promise<void> {
    try {
      const items = await RNFS.readDir(path);
      
      for (const item of items) {
        if (item.isDirectory()) {
          await this.countFilesRecursive(item.path, stats);
        } else {
          const type = getFileType(item.name, false);
          stats.total++;
          stats.totalSize += item.size || 0;
          
          switch (type) {
            case FileType.IMAGE:
              stats.images++;
              break;
            case FileType.VIDEO:
              stats.videos++;
              break;
            case FileType.AUDIO:
              stats.music++;
              break;
            case FileType.DOCUMENT:
              stats.documents++;
              break;
            case FileType.APK:
              stats.apks++;
              break;
            case FileType.ARCHIVE:
              stats.archives++;
              break;
            default:
              stats.others++;
          }
        }
      }
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * 读取文本文件
   */
  async readTextFile(path: string): Promise<string> {
    try {
      if (path.startsWith('smb://')) {
        const tempDir = RNFS.CachesDirectoryPath;
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const tempPath = `${tempDir}/smb_tmp_${Date.now()}_${fileName}`;
        await SMBService.downloadFileByUrl(path, tempPath);
        const content = await this.readFileWithEncoding(tempPath);
        try { await RNFS.unlink(tempPath); } catch (e) {}
        return content;
      }
      // OTG paths: copy to temp first
      if (this.isOTGPath(path)) {
        console.log('[FileService.readTextFile] OTG path detected, path:', path);
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const tempPath = `${RNFS.CachesDirectoryPath}/otg_tmp_${Date.now()}_${fileName}`;
        const otgUri = await USBService.getOTGUri();
        console.log('[FileService.readTextFile] otgUri:', otgUri, 'parentRelPath:', USBService.extractOTGRelativePath(parentPath));
        const relativePath = USBService.extractOTGRelativePath(parentPath);
        await USBService.copyOTGToLocal(otgUri, relativePath, fileName, tempPath);
        const content = await this.readFileWithEncoding(tempPath);
        try { await RNFS.unlink(tempPath); } catch (e) {}
        return content;
      }
      return await this.readFileWithEncoding(path);
    } catch (error) {
      console.error('读取文件失败:', error);
      throw error;
    }
  }

  private async readFileWithEncoding(path: string): Promise<string> {
    // 读取文件为 base64，用于编码检测和转换
    let base64: string;
    try {
      base64 = await RNFS.readFile(path, 'base64');
    } catch (e) {
      throw new Error('无法读取文件');
    }

    // 将 base64 转为 Uint8Array（React Native 无 atob，手动解码）
    const bytes = this.base64ToUint8Array(base64);

    // 检测是否二进制文件（前8192字节中控制字符>5%视为二进制）
    const sampleSize = Math.min(bytes.length, 8192);
    let nonTextCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      const b = bytes[i];
      if (b === 0 || (b < 0x09) || (b > 0x0D && b < 0x20)) {
        nonTextCount++;
      }
    }
    if (nonTextCount / sampleSize > 0.05) {
      // 二进制文件，生成十六进制预览
      return this.generateHexPreview(bytes);
    }

    // 尝试 UTF-8（使用 iconv-lite，React Native 可能无 TextDecoder）
    try {
      const iconv = require('iconv-lite');
      const utf8Content = iconv.decode(bytes, 'utf-8');
      // 检测是否有替换字符（U+FFFD），大量替换字符说明不是 UTF-8
      const replacementCount = (utf8Content.match(/\uFFFD/g) || []).length;
      if (replacementCount <= utf8Content.length * 0.01) {
        return utf8Content;
      }
    } catch {}

    // UTF-8 失败，尝试 GBK/GB2312/GB18030
    try {
      const iconv = require('iconv-lite');
      return iconv.decode(bytes, 'gbk');
    } catch {}

    // 所有编码都失败，用 latin1 读取（不会失败）
    let latin1 = '';
    for (let i = 0; i < bytes.length; i++) {
      latin1 += String.fromCharCode(bytes[i]);
    }
    return latin1;
  }

  /** Base64 解码为 Uint8Array（React Native 兼容） */
  private base64ToUint8Array(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(128);
    for (let i = 0; i < chars.length; i++) {
      lookup[chars.charCodeAt(i)] = i;
    }
    // 去除空白和换行
    base64 = base64.replace(/[\s\r\n]+/g, '');
    const len = base64.length;
    let byteLen = len * 3 / 4;
    if (base64[len - 1] === '=') byteLen--;
    if (base64[len - 2] === '=') byteLen--;
    const bytes = new Uint8Array(byteLen);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
      const a = lookup[base64.charCodeAt(i)] || 0;
      const b = lookup[base64.charCodeAt(i + 1)] || 0;
      const c = lookup[base64.charCodeAt(i + 2)] || 0;
      const d = lookup[base64.charCodeAt(i + 3)] || 0;
      const triple = (a << 18) | (b << 12) | (c << 6) | d;
      if (p < byteLen) bytes[p++] = (triple >> 16) & 0xFF;
      if (p < byteLen) bytes[p++] = (triple >> 8) & 0xFF;
      if (p < byteLen) bytes[p++] = triple & 0xFF;
    }
    return bytes;
  }

  /** 生成二进制文件十六进制预览 */
  private generateHexPreview(bytes: Uint8Array): string {
    const previewLen = Math.min(bytes.length, 4096);
    const hexLines: string[] = [];
    for (let i = 0; i < previewLen; i += 16) {
      const end = Math.min(i + 16, previewLen);
      const hexParts: string[] = [];
      const asciiParts: string[] = [];
      for (let j = i; j < end; j++) {
        hexParts.push(bytes[j].toString(16).padStart(2, '0'));
        const c = bytes[j];
        asciiParts.push(c >= 0x20 && c < 0x7F ? String.fromCharCode(c) : '.');
      }
      const hex = hexParts.join(' ');
      const ascii = asciiParts.join('');
      hexLines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(48)}  ${ascii}`);
    }
    if (bytes.length > 4096) {
      hexLines.push(`\n... 共 ${bytes.length} 字节`);
    }
    return `[二进制文件预览]\n${hexLines.join('\n')}`;
  }

  /**
   * 写入文本文件
   */
  async writeTextFile(path: string, content: string): Promise<boolean> {
    try {
      if (path.startsWith('smb://')) {
        const tempDir = RNFS.CachesDirectoryPath;
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const tempPath = `${tempDir}/smb_tmp_${Date.now()}_${fileName}`;
        await RNFS.writeFile(tempPath, content, 'utf8');
        await SMBService.uploadFileByUrl(tempPath, path);
        try { await RNFS.unlink(tempPath); } catch (e) {}
        return true;
      }
      await RNFS.writeFile(path, content, 'utf8');
      return true;
    } catch (error) {
      console.error('写入文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    // OTG paths
    if (this.isOTGPath(path)) {
      const otgUri = await USBService.getOTGUri();
      console.log('[FileService.exists] OTG path detected, uri:', otgUri, 'path:', path);
      if (!otgUri) return false;
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      const itemName = path.substring(path.lastIndexOf('/') + 1);
      if (!itemName) return false;
      const relativePath = USBService.extractOTGRelativePath(parentPath);
      console.log('[FileService.exists] relativePath:', relativePath, 'itemName:', itemName);
      return await USBService.existsOTGItem(otgUri, relativePath, itemName);
    }
    return await RNFS.exists(path);
  }

  /**
   * 递归统计文件夹内的文件数量和总大小
   */
  async getFolderStats(dirPath: string): Promise<{ count: number; totalSize: number }> {
    let count = 0;
    let totalSize = 0;
    try {
      const items = await RNFS.readDir(dirPath);
      for (const item of items) {
        if (item.isDirectory()) {
          const sub = await this.getFolderStats(item.path);
          count += sub.count;
          totalSize += sub.totalSize;
        } else {
          count++;
          totalSize += item.size || 0;
        }
      }
    } catch (e) {
      // 忽略无权限目录
    }
    return { count, totalSize };
  }

  /**
   * 获取MIME类型
   */
  private getMimeType(fileName: string): string {
    const extension = getFileExtension(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'zip': 'application/zip',
      'apk': 'application/vnd.android.package-archive',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

export default new FileService();


