import { Platform, PermissionsAndroid, Linking, NativeModules } from 'react-native';

/**
 * 请求存储权限（Android 6+），App 启动时调用。
 *
 * 使用硬编码权限字符串，不用 PermissionsAndroid.PERMISSIONS 枚举，
 * 因其在某些设备/RN 版本上会返回 undefined，导致 "permission is null" 崩溃。
 */
export const requestStoragePermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions: string[] = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ];

    // Android 13+ 不需要 WRITE_EXTERNAL_STORAGE（用粒度权限替代）
    if (Platform.Version >= 33) {
      permissions.length = 1; // 只保留 READ
    }

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = permissions.every(
      p => result[p] === PermissionsAndroid.RESULTS.GRANTED,
    );

    return allGranted;
  } catch (error) {
    console.error('权限申请失败:', error);
    return false;
  }
};

/**
 * Android 11+ 检查并请求「全部文件访问权限」(MANAGE_EXTERNAL_STORAGE)
 * 该权限需用户在系统设置中手动开启，无法通过 PermissionsAndroid 静默获取。
 * 返回 true 表示已有权限，false 表示引导用户去设置页面开启。
 */
export const checkAndRequestManageStorage = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || Platform.Version < 30) {
    return true; // Android 10 及以下不需要此权限
  }

  try {
    const SMBModule = NativeModules.SMBModule;
    if (SMBModule && SMBModule.isExternalStorageManager) {
      const isGranted = await SMBModule.isExternalStorageManager();
      if (isGranted) {
        return true;
      }

      // 未授权，弹出确认对话框后再引导用户
      // 注意：需在组件层处理 UI 反馈
      if (SMBModule.openAllFilesAccessSettings) {
        await SMBModule.openAllFilesAccessSettings();
      } else {
        // fallback: 通过 Intent URI 打开全部文件访问权限设置
        await Linking.openURL('app-settings:');
      }
      return false;
    }
    return false;
  } catch (error) {
    console.error('请求全部文件访问权限失败:', error);
    return false;
  }
};
