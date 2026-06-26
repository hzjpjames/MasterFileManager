import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { Promise as ZipPromise } from 'react-native-zip-archive';

/**
 * 压缩服务 - 处理ZIP文件的压缩和解压
 */
class CompressionService {
  /**
   * 压缩文件或文件夹
   */
  async compress(
    sourcePath: string, 
    targetPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // 使用react-native-zip-archive进行压缩
      const zipPath = await ZipPromise.zip(sourcePath, targetPath);
      
      if (onProgress) {
        onProgress(100);
      }
      
      return zipPath;
    } catch (error) {
      console.error('压缩失败:', error);
      throw error;
    }
  }

  /**
   * 解压ZIP文件
   */
  async extract(
    zipPath: string, 
    targetPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // 确保目标目录存在
      const exists = await RNFS.exists(targetPath);
      if (!exists) {
        await RNFS.mkdir(targetPath);
      }

      // 使用react-native-zip-archive进行解压
      const extractPath = await ZipPromise.unzip(zipPath, targetPath);
      
      if (onProgress) {
        onProgress(100);
      }
      
      return extractPath;
    } catch (error) {
      console.error('解压失败:', error);
      throw error;
    }
  }

  /**
   * 获取ZIP文件内容列表
   */
  async getZipContents(zipPath: string): Promise<string[]> {
    try {
      // 这个功能需要原生模块支持
      // 这里返回空数组作为占位符
      return [];
    } catch (error) {
      console.error('获取ZIP内容失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否为支持的压缩格式
   */
  isSupportedArchive(fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['zip'].includes(extension || '');
  }

  /**
   * 获取压缩文件信息
   */
  async getArchiveInfo(zipPath: string): Promise<{
    fileCount: number;
    uncompressedSize: number;
    compressedSize: number;
  }> {
    try {
      const stat = await RNFS.stat(zipPath);
      return {
        fileCount: 0, // 需要原生模块支持
        uncompressedSize: 0,
        compressedSize: stat.size,
      };
    } catch (error) {
      console.error('获取压缩文件信息失败:', error);
      throw error;
    }
  }
}

export default new CompressionService();
