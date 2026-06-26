import { NativeModules, NativeEventEmitter } from 'react-native';
import { SMBConfig, FileItem } from '../types';

const { SMBModule } = NativeModules;

if (!SMBModule) {
  console.error('SMBModule native module not found! Make sure SMBPackage is registered.');
}

/**
 * SMB 服务 - 通过原生模块(jcifs-ng)访问局域网 SMB 共享
 */
class SMBService {
  private connections: Map<string, SMBConfig> = new Map();

  /**
   * 连接到 SMB 服务器
   * config: { server, share, username, password, domain }
   */
  async connect(config: SMBConfig): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');

      const result = await SMBModule.connect({
        server: config.server,
        share: config.share || '',
        username: config.username || '',
        password: config.password || '',
        domain: config.domain || '',
      });

      // 原生模块返回 boolean true 表示成功
      if (result === true) {
        this.connections.set(config.id, config);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('SMB 连接失败:', error);
      throw new Error(`无法连接到 ${config.server}: ${error.message || '未知错误'}`);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(connectionId: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.disconnect();
      this.connections.delete(connectionId);
      return true;
    } catch (error: any) {
      console.error('断开连接失败:', error);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(config: SMBConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (!config.server) {
        return { success: false, message: '服务器地址不能为空' };
      }
      if (!config.share) {
        return { success: false, message: '共享名称不能为空' };
      }

      // 尝试连接
      await this.connect(config);
      await this.disconnect(config.id);
      return { success: true, message: '连接成功' };
    } catch (error: any) {
      return { success: false, message: error.message || '连接失败' };
    }
  }

  /**
   * 列出服务器的共享目录
   */
  async listShares(server: string): Promise<string[]> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      const shares = await SMBModule.listShares(server);
      return shares || [];
    } catch (error: any) {
      console.error('获取共享列表失败:', error);
      throw new Error(`无法获取共享列表: ${error.message}`);
    }
  }

  /**
   * 通过完整 smb:// URL 列出目录（供 FileService 调用）
   */
  async listDirectoryByUrl(url: string): Promise<FileItem[]> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');

      // 确保 URL 以 / 结尾
      if (!url.endsWith('/')) {
        url = url + '/';
      }

      const items = await SMBModule.listDirectory(url);
      return (items || []).map((item: any) => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory,
        size: item.size || 0,
        modifiedTime: item.modifiedTime || Date.now(),
        type: item.isDirectory ? 'directory' : this.detectFileType(item.name, item.extension || ''),
        extension: item.extension || (item.isDirectory ? undefined : ''),
      }));
    } catch (error: any) {
      console.error('列出SMB目录失败:', error);
      throw error;
    }
  }

  /** 根据文件名和扩展名检测文件类型 */
  private detectFileType(name: string, ext: string): string {
    const e = (ext || name.split('.').pop() || '').toLowerCase();
    const imageExts = ['jpg','jpeg','png','gif','bmp','webp','heic','svg','ico'];
    const videoExts = ['mp4','mkv','avi','mov','wmv','flv','3gp','webm'];
    const audioExts = ['mp3','wav','aac','flac','ogg','m4a','wma'];
    const textExts = ['txt','md','xml','json','csv','log','ini','cfg','conf','html','css','js','ts','jsx','tsx','yml','yaml','sh','bat','ps1','sql','py','java','kt','c','cpp','h'];
    if (imageExts.includes(e)) return 'image';
    if (videoExts.includes(e)) return 'video';
    if (audioExts.includes(e)) return 'audio';
    if (textExts.includes(e)) return 'text';
    return 'file';
  }

  /** 创建 SMB 目录 */
  async createDirectory(smbPath: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.createDirectory(smbPath);
      return true;
    } catch (error: any) {
      throw new Error(`SMB创建文件夹失败: ${error.message}`);
    }
  }

  /** 创建 SMB 文件 */
  async createFile(smbPath: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.createFile(smbPath);
      return true;
    } catch (error: any) {
      throw new Error(`SMB创建文件失败: ${error.message}`);
    }
  }

  /**
   * 列出目录内容
   * path: 远程路径，例如 "/" 或 "/Documents"
   */
  async listDirectory(connectionId: string, path: string): Promise<FileItem[]> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');

      const config = this.connections.get(connectionId);
      if (!config) {
        throw new Error('未连接到服务器，请先连接');
      }

      // 调用原生模块
      const items = await SMBModule.listDirectory(path);
      
      // 转换为 FileItem 格式
      return (items || []).map((item: any) => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory,
        size: item.size || 0,
        modifiedTime: item.modifiedTime || Date.now(),
        type: item.type || (item.isDirectory ? 'directory' : 'file'),
        extension: item.extension || '',
      }));
    } catch (error: any) {
      console.error('列出目录失败:', error);
      throw new Error(`无法读取目录: ${error.message}`);
    }
  }

  /**
   * 下载文件到本地
   * remotePath: smb://server/share/path/file.txt
   * localPath: /storage/emulated/0/Download/file.txt
   */
  async downloadFile(
    connectionId: string,
    remotePath: string,
    localPath: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');

      // 简单进度模拟（jcifs-ng 不支持进度回调）
      if (onProgress) {
        onProgress(0);
      }

      await SMBModule.downloadFile(remotePath, localPath);

      if (onProgress) {
        onProgress(100);
      }

      return true;
    } catch (error: any) {
      console.error('下载文件失败:', error);
      throw new Error(`下载失败: ${error.message}`);
    }
  }

  /**
   * 重命名 SMB 文件或文件夹
   */
  async rename(smbUrl: string, newName: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.rename(smbUrl, newName);
      return true;
    } catch (error: any) {
      throw new Error(`SMB重命名失败: ${error.message}`);
    }
  }

  /**
   * 上传文件到 SMB 共享
   */
  async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');

      if (onProgress) {
        onProgress(0);
      }

      await SMBModule.uploadFile(localPath, remotePath);

      if (onProgress) {
        onProgress(100);
      }

      return true;
    } catch (error: any) {
      console.error('上传文件失败:', error);
      throw new Error(`上传失败: ${error.message}`);
    }
  }

  /**
   * 通过 SMB URL 直接下载文件（无需 connectionId，前提是已 connect）
   */
  async downloadFileByUrl(smbUrl: string, localPath: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.downloadFile(smbUrl, localPath);
      return true;
    } catch (error: any) {
      throw new Error(`SMB下载失败: ${error.message}`);
    }
  }

  /**
   * 上传本地文件到 SMB 远程（前提是已 connect）
   */
  async uploadFileByUrl(localPath: string, smbUrl: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.uploadFile(localPath, smbUrl);
      return true;
    } catch (error: any) {
      throw new Error(`SMB上传失败: ${error.message}`);
    }
  }

  /**
   * 获取已保存的连接列表（内存中）
   */
  getSavedConnections(): SMBConfig[] {
    return Array.from(this.connections.values());
  }

  /**
   * 解析 SMB 路径
   * 例如: smb://192.168.0.112/share/Documents
   */
  parseSMBPath(url: string): { server: string; share: string; path: string } | null {
    try {
      const match = url.match(/^smb:\/\/([^\/]+)\/([^\/]+)(\/.*)?$/);
      if (match) {
        return {
          server: match[1],
          share: match[2],
          path: match[3] || '/',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 在 SMB 共享上创建文件夹
   */
  async createDirectory(smbPath: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.createDirectory(smbPath);
      return true;
    } catch (error: any) {
      throw new Error(`SMB创建文件夹失败: ${error.message}`);
    }
  }

  /**
   * 在 SMB 共享上创建文件
   */
  async createFile(smbPath: string): Promise<boolean> {
    try {
      if (!SMBModule) throw new Error('SMBModule native module not available');
      await SMBModule.createFile(smbPath);
      return true;
    } catch (error: any) {
      throw new Error(`SMB创建文件失败: ${error.message}`);
    }
  }

}

export default new SMBService();
