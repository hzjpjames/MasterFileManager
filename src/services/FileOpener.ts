import { NativeModules } from 'react-native';

const { FileOpener } = NativeModules;

class FileOpenerService {
  /**
   * 用系统默认应用打开文件
   */
  async openFile(filePath: string, mimeType?: string): Promise<boolean> {
    try {
      return await FileOpener.openFile(filePath, mimeType || '');
    } catch (error: any) {
      console.error('[FileOpener] openFile error:', error);
      throw error;
    }
  }

  /**
   * 用系统应用选择器打开文件（让用户选择打开方式）
   */
  async openFileWithChooser(filePath: string, mimeType?: string): Promise<boolean> {
    try {
      return await FileOpener.openFileWithChooser(filePath, mimeType || '');
    } catch (error: any) {
      console.error('[FileOpener] openFileWithChooser error:', error);
      throw error;
    }
  }

  /**
   * 分享文件到其他应用
   */
  async shareFile(filePath: string, mimeType?: string): Promise<boolean> {
    try {
      return await FileOpener.shareFile(filePath, mimeType || '');
    } catch (error: any) {
      console.error('[FileOpener] shareFile error:', error);
      throw error;
    }
  }
}

export default new FileOpenerService();
