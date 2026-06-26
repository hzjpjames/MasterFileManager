import { FileType, FileItem } from '../types';

// 文件扩展名映射
const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'heic', 'heif'
];

const VIDEO_EXTENSIONS = [
  'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ts', 'mpeg', 'mpg'
];

const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'ape', 'amr', 'aiff'
];

const DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv'
];

const ARCHIVE_EXTENSIONS = [
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tar.gz', 'tar.bz2'
];

const APK_EXTENSIONS = ['apk'];

const TEXT_EXTENSIONS = [
  'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'log', 'yaml', 'yml', 'ini', 'conf', 'cfg'
];

/**
 * 根据文件扩展名获取文件类型
 */
export function getFileType(fileName: string, isDirectory: boolean): FileType {
  if (isDirectory) {
    return FileType.DIRECTORY;
  }

  const extension = getFileExtension(fileName).toLowerCase();

  if (IMAGE_EXTENSIONS.includes(extension)) {
    return FileType.IMAGE;
  }
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return FileType.VIDEO;
  }
  if (AUDIO_EXTENSIONS.includes(extension)) {
    return FileType.AUDIO;
  }
  if (DOCUMENT_EXTENSIONS.includes(extension)) {
    return FileType.DOCUMENT;
  }
  if (ARCHIVE_EXTENSIONS.includes(extension)) {
    return FileType.ARCHIVE;
  }
  if (APK_EXTENSIONS.includes(extension)) {
    return FileType.APK;
  }
  if (TEXT_EXTENSIONS.includes(extension)) {
    return FileType.TEXT;
  }

  return FileType.OTHER;
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return '';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 获取文件图标名称
 */
export function getFileIcon(item: FileItem): string {
  if (item.isDirectory) {
    return 'folder';
  }

  switch (item.type) {
    case FileType.IMAGE:
      return 'image';
    case FileType.VIDEO:
      return 'video';
    case FileType.AUDIO:
      return 'music';
    case FileType.DOCUMENT:
      return 'file-document';
    case FileType.APK:
      return 'android';
    case FileType.ARCHIVE:
      return 'zip-box';
    case FileType.TEXT:
      return 'file-document-outline';
    default:
      return 'file';
  }
}

/**
 * 获取文件图标颜色
 */
export function getFileIconColor(item: FileItem): string {
  if (item.isDirectory) {
    return '#FFC107';
  }

  switch (item.type) {
    case FileType.IMAGE:
      return '#4CAF50';
    case FileType.VIDEO:
      return '#E91E63';
    case FileType.AUDIO:
      return '#9C27B0';
    case FileType.DOCUMENT:
      return '#2196F3';
    case FileType.APK:
      return '#8BC34A';
    case FileType.ARCHIVE:
      return '#FF5722';
    case FileType.TEXT:
      return '#607D8B';
    default:
      return '#90CAF9';
  }
}

/**
 * 获取MIME类型
 */
export function getMimeType(fileName: string): string {
  const extension = getFileExtension(fileName).toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    // 图片
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // 视频
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    '3gp': 'video/3gpp',
    
    // 音频
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    
    // 文档
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    
    // 压缩包
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // APK
    'apk': 'application/vnd.android.package-archive',
    
    // 其他
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * 验证文件名是否合法
 */
export function isValidFileName(name: string): boolean {
  // 不能为空
  if (!name || name.trim().length === 0) {
    return false;
  }
  
  // 不能包含非法字符
  const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
  if (invalidChars.test(name)) {
    return false;
  }
  
  // 不能以点开头或结尾（Windows）
  if (name.startsWith('.') || name.endsWith('.')) {
    return false;
  }
  
  // 不能是保留名称（Windows）
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reservedNames.includes(name.toUpperCase())) {
    return false;
  }
  
  return true;
}

/**
 * 获取唯一文件名
 */
export function getUniqueFileName(basePath: string, fileName: string, isDirectory: boolean): string {
  // 这里只是占位符，实际实现需要检查文件是否存在
  return fileName;
}

/**
 * 比较文件名用于排序
 */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN', { sensitivity: 'base' });
}
