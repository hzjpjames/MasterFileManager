// 文件项类型
export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: number;
  type: FileType;
  extension?: string;
  thumbnail?: string;
  isBookmarked?: boolean;
}

// 文件类型枚举
export enum FileType {
  DIRECTORY = 'directory',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  APK = 'apk',
  ARCHIVE = 'archive',
  TEXT = 'text',
  OTHER = 'other',
}

// 文件操作类型
export enum FileOperation {
  COPY = 'copy',
  CUT = 'cut',
  DELETE = 'delete',
  RENAME = 'rename',
  COMPRESS = 'compress',
  EXTRACT = 'extract',
}

// 存储位置类型
export interface StorageLocation {
  id: string;
  name: string;
  path: string;
  type: StorageType;
  icon: string;
  totalSpace?: number;
  freeSpace?: number;
}

export enum StorageType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  SMB = 'smb',
  ROOT = 'root',
}

// SMB连接配置
export interface SMBConfig {
  id: string;
  name: string;
  server: string;
  port?: number;
  share: string;
  username?: string;
  password?: string;
  domain?: string;
}

// 书签类型
export interface Bookmark {
  id: string;
  name: string;
  path: string;
  type: StorageType;
  createdAt: number;
}

// 搜索选项
export interface SearchOptions {
  query: string;
  searchInPath: boolean;
  caseSensitive: boolean;
  searchRecursively: boolean;
  fileTypes?: FileType[];
}

// 排序选项
export enum SortBy {
  NAME = 'name',
  SIZE = 'size',
  DATE = 'date',
  TYPE = 'type',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface SortOptions {
  sortBy: SortBy;
  sortOrder: SortOrder;
  foldersFirst: boolean;
}

// 视图模式
export enum ViewMode {
  LIST = 'list',
  GRID = 'grid',
}

// 文件属性
export interface FileProperties {
  name: string;
  path: string;
  type: string;
  size: number;
  sizeFormatted: string;
  createdTime: number;
  modifiedTime: number;
  accessedTime: number;
  isDirectory: boolean;
  isHidden: boolean;
  isReadOnly: boolean;
  permissions: string;
  extension?: string;
  mimeType?: string;
}

// 复制/移动操作状态
export interface OperationProgress {
  operation: FileOperation;
  current: number;
  total: number;
  currentFile: string;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

// 分类统计
export interface CategoryStats {
  images: number;
  videos: number;
  music: number;
  documents: number;
  apks: number;
  archives: number;
  others: number;
  total: number;
  totalSize: number;
}
