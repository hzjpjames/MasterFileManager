import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ToastAndroid,
  Platform,
  BackHandler,
} from 'react-native';
import {
  Text,
  Appbar,
  Menu,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  ProgressBar,
  Snackbar,
  List,
  RadioButton,
  TouchableRipple,
  Divider,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { FileItem, SortBy, SortOrder, ViewMode } from '../types';
import FileList from '../components/FileList';
import FileService from '../services/FileService';
import SMBService from '../services/SMBService';
import USBService from '../services/USBService';
import FileOpener from '../services/FileOpener';
import { getMimeType } from '../utils/fileUtils';
import RNFS from 'react-native-fs';
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type FileBrowserRouteParams = {
  FileBrowser: {
    path: string;
    title: string;
  };
};

const FileBrowserScreen: React.FC = () => {
  const route = useRoute<RouteProp<FileBrowserRouteParams, 'FileBrowser'>>();
  const navigation = useNavigation();
  const { path, title } = route.params || { path: '/', title: '文件浏览' };

  const [files, setFiles] = useState<FileItem[]>([]);
  const [lastInternalPath, setLastInternalPath] = useState<string>('/storage/emulated/0');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(path);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST);
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.NAME);
  const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.ASC);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showSMBList, setShowSMBList] = useState(false);
  const [smbSaved, setSmbSaved] = useState<any[]>([]);
  const [smbConnecting, setSmbConnecting] = useState(false);
  const [clipboard, setClipboard] = useState<{ items: FileItem[]; operation: 'copy' | 'cut' } | null>(null);
  const [bookmarks, setBookmarks] = useState<{ id: string; name: string; path: string }[]>([]);

  // 对话框状态
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState<FileItem | null>(null);
  const [folderStats, setFolderStats] = useState<{ count: number; totalSize: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // 冲突对话框
  const [conflictItems, setConflictItems] = useState<{ src: FileItem; dst: string; isDir: boolean }[]>([]);
  const [conflictAction, setConflictAction] = useState<'overwrite' | 'skip' | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // 加载最近访问的内部存储路径
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('lastInternalPath');
        if (saved) setLastInternalPath(saved);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // 记录内部存储路径变更
  useEffect(() => {
    if (currentPath && !currentPath.startsWith('smb://') && !currentPath.startsWith('/otg/') && !currentPath.startsWith('otg:/') && !currentPath.startsWith('content://') && !currentPath.startsWith('/mnt/media_rw/')) {
      const clean = currentPath.replace(/\/+$/, '');
      if (clean && clean !== '/') {
        setLastInternalPath(clean);
        AsyncStorage.setItem('lastInternalPath', clean).catch(() => {});
      }
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
    loadBookmarks();
    loadViewMode();
    // 恢复全局剪贴板（从 SMB 切换过来时剪贴板不丢）
    if (FileService.globalClipboard) {
      setClipboard(FileService.globalClipboard);
    }
  }, [currentPath]);

  // 排序参数变化时重新加载文件
  useEffect(() => {
    loadFiles();
  }, [sortBy, sortOrder]);

  // 判断是否可以再向上一级
  const canGoUp = useCallback(() => {
    if (currentPath === path) return false;
    if (currentPath.startsWith('smb://')) {
      const clean = currentPath.replace(/\/$/, '');
      const parts = clean.split('/');
      return parts.length > 4;
    }
    // OTG paths: can't go above the mount point
    if (currentPath.startsWith('/mnt/media_rw/')) {
      const clean = currentPath.replace(/\/$/, '');
      const parts = clean.split('/');
      // /mnt/media_rw/UUID = 4 parts = root
      return parts.length > 4;
    }
    if (currentPath.startsWith('/otg/') || currentPath.startsWith('otg:/') || currentPath.startsWith('content://')) {
      const clean = currentPath.replace(/\/$/, '');
      return clean.split('/').length > 2; // more than just /otg or content://root
    }
    return currentPath !== '/';
  }, [currentPath, path]);

  // 拦截 Android 系统返回手势
  // 文件选择模式下：第一次返回 = 取消选择，第二次返回 = 上一级目录
  // 非选择模式下：逐级回退父目录
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        return true; // 消费事件，取消选择
      }
      if (!canGoUp()) {
        return false; // 已到顶，交给系统正常返回
      }
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
      setCurrentPath(parent || '/');
      return true;
    });
    return () => backHandler.remove();
  }, [currentPath, canGoUp, isSelectionMode]);

  const loadFiles = async () => {
    console.log('[FileBrowser] loadFiles currentPath:', currentPath);
    setIsLoading(true);
    try {
      let items;
      // OTG 路径：使用 SAF (DocumentFile API) 列出文件
      if (currentPath.startsWith('/otg/') || currentPath.startsWith('otg:/') || currentPath.startsWith('content://')) {

        const savedUri = await USBService.getOTGUri();
        if (!savedUri) {
          throw new Error('未获得USB存储访问授权，请在首页重新授权');
        }
        const relativePath = USBService.extractOTGRelativePath(currentPath);
        items = await USBService.listOTGDirectory(savedUri, relativePath);
        console.log('[FileBrowser] OTG loaded', items.length, 'items');
      } else {
        // 普通路径：使用 FileService
        items = await FileService.listDirectory(currentPath, {
          sortBy,
          sortOrder,
          foldersFirst: true,
        });
      }
      console.log('[FileBrowser] loaded', items.length, 'items');
      setFiles(items);
    } catch (error: any) {
      console.error('[FileBrowser] loadFiles error:', error.message);
      showToast('加载失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      const saved = await AsyncStorage.getItem('bookmarks');
      if (saved) {
        setBookmarks(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载书签失败:', e);
    }
  };

  const loadViewMode = async () => {
    try {
      const saved = await AsyncStorage.getItem('viewMode');
      if (saved) {
        setViewMode(saved as ViewMode);
      }
    } catch (e) {
      console.error('加载视图模式失败:', e);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      setSnackbarMessage(message);
    }
  };

  const handleFilePress = (item: FileItem) => {
    console.log('[FileBrowser] handleFilePress:', { name: item.name, isDirectory: item.isDirectory, path: item.path, type: item.type });
    if (item.isDirectory) {
      console.log('[FileBrowser] navigating to directory:', item.path);
      setCurrentPath(item.path);
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      handleOpenFile(item);
    }
  };

  const handleOpenFile = async (item: FileItem) => {
    // 只有纯文本类文件才用内置编辑器打开（只读模式）
    const isTxtFile = isTextExtension(item.name);
    if (isTxtFile) {
      (navigation as any).navigate('TextEditor', { path: item.path });
      return;
    }
    // 图片用内置查看器
    if (item.type === 'image') {
      (navigation as any).navigate('ImageViewer', { path: item.path, currentDir: currentPath });
      return;
    }
    // 其他所有文件类型都用系统应用打开
    let localPath = item.path;
    // SMB 文件需要先下载到本地缓存
    if (item.path.startsWith('smb://')) {
      try {
        showToast('正在准备文件...');
        const cacheDir = RNFS.CachesDirectoryPath;
        const tempFile = `${cacheDir}/${item.name}`;
        await SMBService.downloadFileByUrl(item.path, tempFile);
        localPath = tempFile;
      } catch (e: any) {
        console.error('[OpenFile] SMB download error:', e?.message || e);
        showToast('无法打开此文件类型');
        return;
      }
    }
    // OTG/USB 文件需要先复制到本地缓存
    if (item.path.startsWith('/otg/') || item.path.startsWith('otg:/') || item.path.startsWith('content://')) {
      try {
        showToast('正在准备文件...');
        const cacheDir = RNFS.CachesDirectoryPath;
        const tempFile = `${cacheDir}/${item.name}`;
        const otgUri = await USBService.getOTGUri();
        const parentRelPath = USBService.extractOTGRelativePath(
          item.path.substring(0, item.path.lastIndexOf('/'))
        );
        await USBService.copyOTGToLocal(otgUri, parentRelPath, item.name, tempFile);
        localPath = tempFile;
      } catch (e: any) {
        console.error('[OpenFile] OTG download error:', e?.message || e);
        showToast('无法打开此文件');
        return;
      }
    }
    const mime = getMimeType(item.name);
    // doc/xls/ppt/pdf 等文档类型用选择器，让用户选择打开方式
    const docExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'rtf', 'odt', 'ods', 'odp'];
    const ext = (item.name.split('.').pop() || '').toLowerCase();
    if (docExtensions.includes(ext)) {
      FileOpener.openFileWithChooser(localPath, mime).catch(() =>
        showToast('无法打开此文件类型')
      );
    } else {
      FileOpener.openFile(localPath, mime).catch(() =>
        showToast('无法打开此文件类型')
      );
    }
  };

  const handleFileLongPress = (item: FileItem) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    handleToggleSelect(item);
  };

  const handleToggleSelect = (item: FileItem) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.path)) {
      newSelected.delete(item.path);
    } else {
      newSelected.add(item.path);
    }
    setSelectedItems(newSelected);

    if (newSelected.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.size === files.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(files.map(f => f.path)));
    }
  };

  const handleCopy = () => {
    const items = files.filter(f => selectedItems.has(f.path));
    const cb = { items, operation: 'copy' as const };
    setClipboard(cb);
    FileService.globalClipboard = cb;
    showToast(`已复制 ${items.length} 项`);
  };

  const handleCut = () => {
    const items = files.filter(f => selectedItems.has(f.path));
    const cb = { items, operation: 'cut' as const };
    setClipboard(cb);
    FileService.globalClipboard = cb;
    showToast(`已剪切 ${items.length} 项`);
  };

  const handlePaste = async (forceOverwrite: boolean = false) => {
    if (!clipboard) return;

    try {
      if (!forceOverwrite) {
        // 先检查是否有冲突
        const conflicts: { src: FileItem; dst: string; isDir: boolean }[] = [];
        for (const item of clipboard.items) {
          const destFull = `${currentPath}/${item.name}`;
          const destExists = item.path.startsWith('smb://')
            ? false // SMB 源无法直接检查本地目标，先跳过
            : await FileService.exists(destFull);
          if (destExists) {
            conflicts.push({ src: item, dst: destFull, isDir: item.isDirectory });
          }
        }
        if (conflicts.length > 0) {
          setConflictItems(conflicts);
          setShowConflictDialog(true);
          return;
        }
      }

      // 执行粘贴
      await doPaste(forceOverwrite);
    } catch (error: any) {
      showToast('粘贴失败: ' + error.message);
    }
  };

  const doPaste = async (overwrite: boolean = false) => {
    if (!clipboard) return;
    try {
      for (const item of clipboard.items) {
        if (clipboard.operation === 'copy') {
          await FileService.copy(item.path, currentPath, overwrite);
        } else {
          await FileService.move(item.path, currentPath, overwrite);
        }
      }
      showToast('粘贴成功');
      setClipboard(null);
      FileService.globalClipboard = null;
      loadFiles();
    } catch (error: any) {
      showToast('粘贴失败: ' + error.message);
    }
  };

  const handleShare = async () => {
    if (selectedItems.size !== 1) {
      showToast('请选择一个文件进行分享');
      return;
    }
    const file = files.find(f => selectedItems.has(f.path));
    if (!file || file.isDirectory) {
      showToast('无法分享文件夹');
      return;
    }
    const mime = getMimeType(file.name);
    let localPath = file.path;
    // SMB 文件需要先下载到本地缓存再分享
    if (file.path.startsWith('smb://')) {
      try {
        showToast('正在准备文件...');
        const cacheDir = RNFS.CachesDirectoryPath;
        const tempFile = `${cacheDir}/${file.name}`;
        await SMBService.downloadFileByUrl(file.path, tempFile);
        localPath = tempFile;
      } catch (e: any) {
        console.error('[Share] SMB download error:', e?.message || e);
        showToast('分享失败: 无法下载远程文件');
        return;
      }
    }
    // OTG 文件需要先复制到本地缓存
    if (file.path.startsWith('/mnt/media_rw/') || file.path.startsWith('/otg/') || file.path.startsWith('otg:/') || file.path.startsWith('content://')) {
      try {
        showToast('正在准备文件...');
        const cacheDir = RNFS.CachesDirectoryPath;
        const tempFile = `${cacheDir}/${file.name}`;
        const otgUri = await USBService.getOTGUri();
        const parentRelPath = USBService.extractOTGRelativePath(
          file.path.substring(0, file.path.lastIndexOf('/'))
        );
        await USBService.copyOTGToLocal(otgUri, parentRelPath, file.name, tempFile);
        localPath = tempFile;
      } catch (e: any) {
        console.error('[Share] OTG download error:', e?.message || e);
        showToast('分享失败: 无法读取USB文件');
        return;
      }
    }
    console.log('[Share] sharing:', localPath, 'mime:', mime);
    FileOpener.shareFile(localPath, mime).catch((err: any) => {
      console.error('[Share] error:', err?.message || err);
      showToast('分享失败: ' + (err?.message || '请重试'));
    });
  };

  const handleDelete = () => {
    const count = selectedItems.size;
    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${count} 项吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileService.deleteMultiple(Array.from(selectedItems));
              showToast('删除成功');
              setSelectedItems(new Set());
              setIsSelectionMode(false);
              loadFiles();
            } catch (error: any) {
              showToast('删除失败: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleRename = async () => {
    if (!selectedFile || !inputValue.trim()) return;

    try {
      await FileService.rename(selectedFile.path, inputValue.trim());
      showToast('重命名成功');
      setShowRenameDialog(false);
      setSelectedFile(null);
      setInputValue('');
      loadFiles();
    } catch (error: any) {
      showToast('重命名失败: ' + error.message);
    }
  };

  const handleCreateFolder = async () => {
    if (!inputValue.trim()) return;

    try {
      await FileService.createFolder(currentPath, inputValue.trim());
      showToast('创建成功');
      setShowNewFolderDialog(false);
      setInputValue('');
      loadFiles();
    } catch (error: any) {
      showToast('创建失败: ' + error.message);
    }
  };

  const handleCreateFile = async () => {
    if (!inputValue.trim()) return;

    try {
      await FileService.createFile(currentPath, inputValue.trim());
      showToast('创建成功');
      setShowNewFileDialog(false);
      setInputValue('');
      loadFiles();
    } catch (error: any) {
      showToast('创建失败: ' + error.message);
    }
  };

  const handleToggleBookmark = async () => {
    const isBookmarked = bookmarks.some(b => b.path === currentPath);
    let newBookmarks;

    if (isBookmarked) {
      newBookmarks = bookmarks.filter(b => b.path !== currentPath);
      showToast('已取消收藏');
    } else {
      const name = currentPath.split('/').pop() || currentPath;
      newBookmarks = [...bookmarks, { id: Date.now().toString(), name, path: currentPath }];
      showToast('已添加收藏');
    }

    setBookmarks(newBookmarks);
    await AsyncStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
  };

  const handleGoBack = () => {
    if (currentPath === path) {
      navigation.goBack();
    } else {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      setCurrentPath(parentPath || '/');
    }
  };

  const handleOTGListPress = async () => {
    try {
      const savedUri = await USBService.getOTGUri();
      if (savedUri) {
        (navigation as any).navigate('FileBrowser', { path: '/otg/', title: 'USB 存储' });
      } else {
        showToast('请先在首页授权 USB 设备');
      }
    } catch (e: any) {
      showToast('无法访问 USB: ' + (e?.message || '未知错误'));
    }
  };

  const handleSMBListPress = async () => {
    try {
      const saved = await AsyncStorage.getItem('smb_connections');
      const list = saved ? JSON.parse(saved) : [];
      setSmbSaved(list);
      setShowSMBList(true);
    } catch (e) {
      showToast('读取历史连接失败');
    }
  };

  const handleSMBQuickConnect = async (config: any) => {
    setSmbConnecting(true);
    try {
      await SMBService.connect(config);
      setShowSMBList(false);
      const smbPath = `smb://${config.server}/${config.share}`;
      setCurrentPath(smbPath);
    } catch (error: any) {
      showToast('连接失败: ' + error.message);
    } finally {
      setSmbConnecting(false);
    }
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === ViewMode.LIST ? ViewMode.GRID : ViewMode.LIST;
    setViewMode(newMode);
    await AsyncStorage.setItem('viewMode', newMode);
  };

  const isCurrentPathBookmarked = bookmarks.some(b => b.path === currentPath);

  // 取消全选
  const handleDeselectAll = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  // 反选
  const handleInvertSelection = () => {
    const newSet = new Set<string>();
    files.forEach(f => {
      if (!selectedItems.has(f.path)) newSet.add(f.path);
    });
    setSelectedItems(newSet);
  };

  // 全选并进入选择模式
  const handleSelectAllAndEnter = () => {
    setSelectedItems(new Set(files.map(f => f.path)));
    setIsSelectionMode(true);
  };

  // 单个重命名触发
  const handleTriggerRename = () => {
    const selected = files.find(f => selectedItems.has(f.path));
    if (selected) {
      setSelectedFile(selected);
      setInputValue(selected.name);
      setShowRenameDialog(true);
    } else {
      showToast('请选择一项');
    }
  };

  const isTextExtension = (name: string): boolean => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    // 只有纯文本格式的文件才用内置编辑器打开，避免二进制文件乱码
    const textExts = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
      'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'log', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'sql',
      'properties', 'gradle', 'toml', 'prop'];
    return textExts.includes(ext);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  };

  const handleShowProperties = async (item: FileItem | null) => {
    const target = item || (selectedItems.size === 1 ? files.find(f => selectedItems.has(f.path)) : null);
    if (!target) {
      if (selectedItems.size > 1) {
        // 多文件属性：聚合大小
        let totalSize = 0;
        files.forEach(f => { if (selectedItems.has(f.path)) totalSize += f.size || 0; });
        setPropertiesItem({
          name: `${selectedItems.size} 项`,
          path: currentPath,
          isDirectory: false,
          size: totalSize,
          modifiedTime: 0,
          type: '',
        });
        setFolderStats(null);
      } else {
        // 显示当前目录属性
        setPropertiesItem({
          name: currentPath.split('/').pop() || currentPath,
          path: currentPath,
          isDirectory: true,
          size: 0,
          modifiedTime: 0,
          type: '文件夹',
        });
        setFolderStats(null);
      }
    } else {
      setPropertiesItem(target);
      setFolderStats(null);
      // 跳过 SMB、OTG 路径的文件夹统计（RNFS 不支持）
      // 支持 /mnt/media_rw/, /otg/, otg:/, content:// 所有格式
      if (target.isDirectory && 
          !target.path.startsWith('smb://') && 
          !target.path.startsWith('/mnt/media_rw/') && 
          !target.path.startsWith('/otg/') &&
          !target.path.startsWith('otg:/') &&
          !target.path.startsWith('content://')) {
        try {
          const stats = await FileService.getFolderStats(target.path);
          setFolderStats(stats);
        } catch (e) {
          // ignore
        }
      }
    }
    setShowPropertiesDialog(true);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        {isSelectionMode ? (
          <Appbar.Action icon="close" onPress={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} />
        ) : (
          <>
            <Appbar.Action icon="home" onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Home' })} style={{ marginLeft: 2, marginRight: 2 }} />
            <Appbar.Action icon="cellphone" onPress={() => {
              const savedPath = lastInternalPath || (RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0');
              setCurrentPath(savedPath);
            }} style={{ marginLeft: 2, marginRight: 2 }} />
            <Appbar.Action icon="usb-flash-drive" onPress={async () => {
              try {
                const savedUri = await USBService.getOTGUri();
                if (savedUri) {
                  setCurrentPath('/otg/');
                } else {
                  showToast('请先在首页授权 USB 设备');
                }
              } catch (e: any) {
                showToast('无法访问 USB: ' + (e?.message || '未知错误'));
              }
            }} style={{ marginLeft: 2, marginRight: 2 }} />
            <Appbar.Action icon="server-network" onPress={handleSMBListPress} style={{ marginLeft: 2, marginRight: 2 }} />
          </>
        )}
        <Appbar.Content
          title={isSelectionMode ? `已选 ${selectedItems.size} 项` : ''}
          titleStyle={isSelectionMode ? { fontSize: 12 } : undefined}
        />
        {isSelectionMode ? (
          <>
            <Appbar.Action icon="content-copy" onPress={handleCopy} disabled={selectedItems.size === 0} size={20} style={{ marginLeft: -3, marginRight: -6 }} />
            <Appbar.Action icon="pencil" onPress={handleTriggerRename} disabled={selectedItems.size !== 1} size={20} style={{ marginLeft: -3, marginRight: -6 }} />
            <Appbar.Action icon="share-variant" onPress={handleShare} disabled={selectedItems.size !== 1} size={20} style={{ marginLeft: -3, marginRight: -6 }} />
            <Appbar.Action
              icon={selectedItems.size === files.length ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
              onPress={() => {
                if (selectedItems.size === files.length) {
                  setSelectedItems(new Set());
                  setIsSelectionMode(false);
                } else {
                  setSelectedItems(new Set(files.map(f => f.path)));
                }
              }}
              size={20}
              style={{ marginLeft: -3, marginRight: -6 }}
            />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', marginRight: -8 }}>
              <Appbar.Action icon={isCurrentPathBookmarked ? 'bookmark' : 'bookmark-outline'} onPress={handleToggleBookmark} style={{ marginLeft: 0, marginRight: -8 }} />
              <Appbar.Action icon={sortOrder === SortOrder.ASC ? 'sort-ascending' : 'sort-descending'} onPress={() => { setSortOrder(sortOrder === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC); }} style={{ marginLeft: 0, marginRight: -8 }} />
              <Appbar.Action icon="select-all" onPress={() => handleSelectAllAndEnter()} style={{ marginLeft: 0, marginRight: 4 }} />
            </View>
          </>
        )}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
        >
          {isSelectionMode ? (
            <>
              <Menu.Item onPress={() => { setMenuVisible(false); if (selectedItems.size === files.length) { handleDeselectAll(); } else { setSelectedItems(new Set(files.map(f => f.path))); } }} title="全选" />
              <Menu.Item onPress={() => { setMenuVisible(false); handleInvertSelection(); }} title="反选" />
              <Menu.Item onPress={() => { setMenuVisible(false); handleCopy(); }} title="复制" />
              {(clipboard || FileService.globalClipboard) && (
                <Menu.Item onPress={() => { setMenuVisible(false); handlePaste(); }} title="粘贴" />
              )}
              <Menu.Item onPress={() => { setMenuVisible(false); handleCut(); }} title="剪切" />
              {selectedItems.size === 1 && (
                <>
                  <Menu.Item onPress={() => { setMenuVisible(false); handleTriggerRename(); }} title="更名" />
                  <Menu.Item onPress={() => { setMenuVisible(false); handleShare(); }} title="分享" />
                </>
              )}
              <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }} title="删除" />
              <Menu.Item onPress={() => { setMenuVisible(false); handleShowProperties(null); }} title="属性" />
            </>
          ) : (
            <>
              <Menu.Item onPress={() => { setMenuVisible(false); handleSelectAllAndEnter(); }} title="全选" />
              <Menu.Item onPress={() => { setMenuVisible(false); setShowNewFolderDialog(true); }} title="新建文件夹" />
              <Menu.Item onPress={() => { setMenuVisible(false); setShowNewFileDialog(true); }} title="新建文件" />
              {(clipboard || FileService.globalClipboard) && (
                <Menu.Item onPress={() => { setMenuVisible(false); handlePaste(); }} title="粘贴" />
              )}
              <Menu.Item onPress={() => { setMenuVisible(false); handleShowProperties(null); }} title="属性" />
              <Menu.Item onPress={() => { setMenuVisible(false); setShowSortDialog(true); }} title="排序" />
            </>
          )}
        </Menu>
      </Appbar.Header>
      {!isSelectionMode && (
        <View style={{ backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, color: '#666' }} numberOfLines={1}>{currentPath}</Text>
        </View>
      )}

      <FileList
        files={files}
        isLoading={isLoading}
        isSelectionMode={isSelectionMode}
        selectedItems={selectedItems}
        viewMode={viewMode}
        onFilePress={handleFilePress}
        onFileLongPress={handleFileLongPress}
        onToggleSelect={handleToggleSelect}
        onRefresh={loadFiles}
      />

      {/* 共享文件夹列表对话框 */}
      <Portal>
        <Dialog visible={showSMBList} onDismiss={() => setShowSMBList(false)}>
          <Dialog.Title>已访问的共享文件夹</Dialog.Title>
          <Dialog.Content>
            {smbSaved.length === 0 ? (
              <Text style={{ color: colors.gray, textAlign: 'center', paddingVertical: 20 }}>
                暂无历史连接，请先到「连接网络存储」添加
              </Text>
            ) : (
              smbSaved.map((conn: any) => (
                <List.Item
                  key={conn.id}
                  title={conn.name || conn.share}
                  description={`${conn.server}/${conn.share}`}
                  left={props => <List.Icon {...props} icon="folder-network" />}
                  onPress={() => handleSMBQuickConnect(conn)}
                  disabled={smbConnecting}
                />
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSMBList(false)}>关闭</Button>
            <Button
              onPress={() => {
                setShowSMBList(false);
                (navigation as any).navigate('SMBConnect');
              }}
            >
              新建连接
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 新建文件夹对话框 */}
      <Portal>
        <Dialog visible={showNewFolderDialog} onDismiss={() => setShowNewFolderDialog(false)}>
          <Dialog.Title>新建文件夹</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="文件夹名称"
              value={inputValue}
              onChangeText={setInputValue}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNewFolderDialog(false)}>取消</Button>
            <Button onPress={handleCreateFolder}>创建</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 新建文件对话框 */}
      <Portal>
        <Dialog visible={showNewFileDialog} onDismiss={() => setShowNewFileDialog(false)}>
          <Dialog.Title>新建文件</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="文件名称"
              value={inputValue}
              onChangeText={setInputValue}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNewFileDialog(false)}>取消</Button>
            <Button onPress={handleCreateFile}>创建</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 重命名对话框 */}
      <Portal>
        <Dialog visible={showRenameDialog} onDismiss={() => setShowRenameDialog(false)}>
          <Dialog.Title>重命名</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="新名称"
              value={inputValue}
              onChangeText={setInputValue}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRenameDialog(false)}>取消</Button>
            <Button onPress={handleRename}>确定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 属性对话框 */}
      <Portal>
        <Dialog visible={showPropertiesDialog} onDismiss={() => setShowPropertiesDialog(false)}>
          <Dialog.Title>属性</Dialog.Title>
          <Dialog.Content>
            {propertiesItem && (
              <View>
                <List.Item title={propertiesItem.name} description="名称" left={props => <List.Icon {...props} icon={propertiesItem.isDirectory ? 'folder' : 'file'} />} />
                <Divider />
                <List.Item title={propertiesItem.isDirectory ? '文件夹' : (propertiesItem.name.lastIndexOf('.') > 0 ? '.' + propertiesItem.name.split('.').pop() : '文件')} description="类型" />
                <Divider />
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <Text selectable style={{ fontSize: 14, color: '#000' }}>{propertiesItem.path}</Text>
                  </ScrollView>
                  <Text style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>路径</Text>
                </View>
                <Divider />
                {propertiesItem.isDirectory && folderStats ? (
                  <>
                    <List.Item title={`${folderStats.count} 个文件`} description="包含" />
                    <Divider />
                    <List.Item title={formatSize(folderStats.totalSize)} description="总大小" />
                  </>
                ) : !propertiesItem.isDirectory ? (
                  <>
                    <List.Item title={formatSize(propertiesItem.size || 0)} description="大小" />
                    <Divider />
                    {propertiesItem.modifiedTime > 0 && (
                      <List.Item title={new Date(propertiesItem.modifiedTime).toLocaleString()} description="修改时间" />
                    )}
                  </>
                ) : null}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPropertiesDialog(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 排序对话框 */}
      <Portal>
        <Dialog visible={showSortDialog} onDismiss={() => setShowSortDialog(false)}>
          <Dialog.Title>排序</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <TouchableRipple onPress={() => setSortBy(SortBy.NAME)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortBy.NAME} />
                  <Text>按名称</Text>
                </View>
              </TouchableRipple>
              <TouchableRipple onPress={() => setSortBy(SortBy.SIZE)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortBy.SIZE} />
                  <Text>按大小</Text>
                </View>
              </TouchableRipple>
              <TouchableRipple onPress={() => setSortBy(SortBy.DATE)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortBy.DATE} />
                  <Text>按时间</Text>
                </View>
              </TouchableRipple>
              <TouchableRipple onPress={() => setSortBy(SortBy.TYPE)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortBy.TYPE} />
                  <Text>按类型</Text>
                </View>
              </TouchableRipple>
            </RadioButton.Group>
            <Divider style={{ marginVertical: 8 }} />
            <RadioButton.Group
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as SortOrder)}
            >
              <TouchableRipple onPress={() => setSortOrder(SortOrder.ASC)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortOrder.ASC} />
                  <Text>升序</Text>
                </View>
              </TouchableRipple>
              <TouchableRipple onPress={() => setSortOrder(SortOrder.DESC)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton value={SortOrder.DESC} />
                  <Text>降序</Text>
                </View>
              </TouchableRipple>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSortDialog(false)}>确定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 粘贴冲突对话框 */}
      <Portal>
        <Dialog visible={showConflictDialog} onDismiss={() => setShowConflictDialog(false)}>
          <Dialog.Title>文件名冲突</Dialog.Title>
          <Dialog.Content>
            {conflictItems.map((c, i) => (
              <Text key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                {c.isDir ? '📁' : '📄'} {c.src.name} — 目标已存在{c.isDir ? '同名文件夹' : '同名文件'}
              </Text>
            ))}
            <Text style={{ marginTop: 8, fontSize: 13, color: colors.gray }}>
              {conflictItems.some(c => c.isDir)
                ? '选择「合并」将保留两边的文件，同名文件被源文件覆盖'
                : '选择「覆盖」将替换目标文件，不可恢复'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setShowConflictDialog(false); }}>取消</Button>
            <Button
              onPress={() => {
                setShowConflictDialog(false);
                doPaste(true);
              }}
            >
              {conflictItems.some(c => c.isDir) ? '合并' : '覆盖'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage('')}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectionText: {
    color: colors.white,
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: 'row',
  },
});

export default FileBrowserScreen;
