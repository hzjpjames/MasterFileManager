// SMBModule 原生模块类型声明
export interface SMBModuleType {
  connect(config: {
    server: string;
    share: string;
    username: string;
    password: string;
    domain: string;
  }): Promise<{ success: boolean; message: string }>;

  disconnect(): Promise<boolean>;

  listShares(server: string): Promise<string[]>;

  listDirectory(path: string): Promise<
    Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modifiedTime: number;
      type: string;
      extension?: string;
    }>
  >;

  downloadFile(remotePath: string, localPath: string): Promise<boolean>;

  uploadFile(localPath: string, remotePath: string): Promise<boolean>;
}

import { NativeModules } from 'react-native';
declare global {
  namespace NativeModules {
    const SMBModule: SMBModuleType | undefined;
  }
  interface NativeModules {
    SMBModule: SMBModuleType | undefined;
  }
}
