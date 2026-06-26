import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeModules,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Dialog,
  Portal,
  Button,
  List,
  Paragraph,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import { colors } from '../constants/theme';
import { StorageType, StorageLocation } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestStoragePermissions, checkAndRequestManageStorage } from '../services/PermissionService';
import USBService from '../services/USBService';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [bookmarks, setBookmarks] = useState<{ id: string; name: string; path: string }[]>([]);
  const [showStorageInfo, setShowStorageInfo] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState<StorageLocation | null>(null);
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  useEffect(() => {
    loadStorageLocations();
    loadBookmarks();
    initPermissions();

    // 监听 USB 热插拔
    const subscription = USBService.onUSBStateChanged((event) => {
      console.log('[HomeScreen] USB_STATE_CHANGED:', event);
      // 延迟重新扫描，等待系统完成挂载
      setTimeout(() => loadStorageLocations(), 500);
    });

    // 监听设置页面触发的刷新事件
    const refreshSubscription = DeviceEventEmitter.addListener('REFRESH_STORAGE', () => {
      console.log('[HomeScreen] Received REFRESH_STORAGE event');
      loadStorageLocations();
    });

    // 启动后延迟扫描两次，解决先打开 App 后插入 OTG 的问题
    const timer1 = setTimeout(() => loadStorageLocations(), 3000);
    const timer2 = setTimeout(() => loadStorageLocations(), 8000);

    return () => {
      subscription.remove();
      refreshSubscription.remove();
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const initPermissions = async () => {
    requestStoragePermissions();
    const hasManage = await checkAndRequestManageStorage();
    if (!hasManage) {
      setShowPermissionDialog(true);
    }
  };

  const loadStorageLocations = async () => {
    const locations: StorageLocation[] = [];

    // 内部存储
    try {
      const internalPath = RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0';
      locations.push({
        id: 'internal',
        name: '内部存储',
        path: internalPath,
        type: StorageType.INTERNAL,
        icon: 'cellphone',
      });
    } catch (e) {
      console.error('获取内部存储路径失败:', e);
    }

    // 外部存储 (SD卡 + USB OTG) — 使用原生模块扫描
    try {
      const usbVolumes = await USBService.scanVolumes();
      for (const vol of usbVolumes) {
        const volName = vol.displayName || '外部存储';
        const icon = volName.includes('SD') || volName.includes('SD卡') ? 'sd' : 'usb-flash-drive';
        const isMounted = vol.mounted === true && vol.path && vol.path.length > 0;
        const label = vol.uuid || vol.name || volName;
        locations.push({
          id: `external_${vol.uuid || vol.name || Date.now()}`,
          name: isMounted ? `${volName} (${label})` : `${volName} [未挂载] (${label})`,
          path: isMounted ? vol.path : '',
          type: StorageType.EXTERNAL,
          icon: isMounted ? icon : 'usb-flash-drive-outline',
        });
      }
    } catch (e) {
      console.error('扫描外部存储失败:', e);
    }

    setStorageLocations(locations);

    // 如果发现了未挂载的卷，延迟 1.5 秒后重新扫描
    const hasUnmounted = locations.some(l => l.name.includes('未挂载'));
    if (hasUnmounted) {
      setTimeout(() => loadStorageLocations(), 1500);
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

  /**
   * 处理 OTG USB 存储访问：
   * 1. 先检查是否已有持久化的 SAF URI
   * 2. 有则直接进入 FileBrowser
   * 3. 没有则先请求 SAF 授权，授权成功后再进入 FileBrowser
   */
  const handleOTGAccess = async (location: StorageLocation) => {
    try {
      let savedUri = '';
      try { savedUri = await USBService.getOTGUri(); } catch {}
      let isValid = false;
      if (savedUri) {
        try {
          isValid = await USBService.isUriValid(savedUri);
        } catch (e) {
          isValid = false;
        }
      }
      
      if (savedUri && isValid) {
        // 有有效授权，直接导航
        (navigation as any).navigate('FileBrowser', {
          path: '/otg/',
          title: location.name,
        });
      } else {
        // 无授权或已失效，先请求 SAF 授权
        // 显示操作指引，帮助用户正确授权（只需授权一次）
        Alert.alert(
          '授权USB存储',
          '首次访问USB需要系统授权（仅需一次）。\n\n操作步骤：\n1. 在弹出的系统选择器中，确认已选中U盘根目录\n2. 点击底部「使用此文件夹」按钮\n3. 在确认框中点击「允许」\n\n授权成功后，以后访问USB将不再需要此步骤。',
          [
            {
              text: '知道了',
              onPress: async () => {
                try {
                  const uri = await USBService.requestOTGAccess();
                  if (uri) {
                    // 授权成功，保存 URI 并导航
                    await USBService.setOTGUri(uri);
                    (navigation as any).navigate('FileBrowser', {
                      path: '/otg/',
                      title: location.name,
                    });
                  } else {
                    Alert.alert('提示', '未获得USB存储访问授权');
                  }
                } catch (e: any) {
                  Alert.alert('错误', '无法访问 USB 存储:\n' + String(e?.message || e));
                }
              },
            },
            {
              text: '取消',
              style: 'cancel',
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('错误', '无法访问 USB 存储:\n' + String(e?.message || e) + '\nType: ' + typeof e + '\nStack: ' + (e?.stack || 'N/A'));
    }
  };

  const handleStoragePress = async (location: StorageLocation) => {
    if (!location.path) {
      return;
    }
    // 外部存储（USB OTG 等）走 SAF 授权流程
    if (location.type === 'external') {
      await handleOTGAccess(location);
      return;
    }
    // 普通路径（内部存储等）
    (navigation as any).navigate('FileBrowser', {
      path: location.path,
      title: location.name,
    });
  };

  const handleBookmarkPress = (bookmark: { path: string; name: string }) => {
    (navigation as any).navigate('FileBrowser', {
      path: bookmark.path,
      title: bookmark.name,
    });
  };

  const handleSMBPress = () => {
    (navigation as any).navigate('SMBConnect');
  };

  // 手动刷新存储位置（右上角刷新按钮）
  const handleRefreshStorage = () => {
    loadStorageLocations();
  };

  const handleStorageInfo = (location: StorageLocation) => {
    setSelectedStorage(location);
    setShowStorageInfo(true);
  };

  const renderStorageCard = (location: StorageLocation) => (
    <Card
      key={location.id}
      style={styles.storageCard}
      onPress={() => handleStoragePress(location)}
    >
      <View style={styles.storageCardHeader}>
        <MaterialCommunityIcons
          name={location.icon}
          size={32}
          color={colors.primary}
        />
        <View style={styles.storageCardInfo}>
          <Text style={styles.storageName}>{location.name}</Text>
          <Text style={styles.storagePath} numberOfLines={1}>
            {location.path}
          </Text>
        </View>
        <IconButton
          icon="information-outline"
          size={20}
          onPress={() => handleStorageInfo(location)}
        />
      </View>
    </Card>
  );

  const renderBookmarkItem = (bookmark: { id: string; name: string; path: string }) => (
    <List.Item
      key={bookmark.id}
      title={bookmark.name}
      description={bookmark.path}
      left={(props) => <List.Icon {...props} icon="bookmark" />}
      onPress={() => handleBookmarkPress(bookmark)}
    />
  );

  return (
    <View style={styles.container}>
      {/* 顶部标题栏 + 刷新按钮 */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>文件管理器</Text>
        <IconButton
          icon="refresh"
          size={24}
          iconColor={colors.primary}
          onPress={handleRefreshStorage}
        />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 存储位置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>存储位置</Text>
          {storageLocations.map(renderStorageCard)}
          
          {/* 网络存储 */}
          <Card style={styles.storageCard} onPress={handleSMBPress}>
            <View style={styles.storageCardHeader}>
              <MaterialCommunityIcons
                name="lan-connect"
                size={32}
                color={colors.accent}
              />
              <View style={styles.storageCardInfo}>
                <Text style={styles.storageName}>网络存储 (SMB)</Text>
                <Text style={styles.storagePath}>连接局域网共享文件夹</Text>
              </View>
              <IconButton icon="chevron-right" size={20} />
            </View>
          </Card>
        </View>

        {/* 快速访问 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速访问</Text>
          <View style={styles.quickAccessGrid}>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'images' })}
            >
              <MaterialCommunityIcons name="image-multiple" size={32} color={colors.image} />
              <Text style={styles.quickAccessText}>图片</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'videos' })}
            >
              <MaterialCommunityIcons name="video" size={32} color={colors.video} />
              <Text style={styles.quickAccessText}>视频</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'music' })}
            >
              <MaterialCommunityIcons name="music" size={32} color={colors.music} />
              <Text style={styles.quickAccessText}>音乐</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'documents' })}
            >
              <MaterialCommunityIcons name="file-document-multiple" size={32} color={colors.document} />
              <Text style={styles.quickAccessText}>文档</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'apks' })}
            >
              <MaterialCommunityIcons name="android" size={32} color={colors.apk} />
              <Text style={styles.quickAccessText}>安装包</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => (navigation as any).navigate('Category', { type: 'downloads' })}
            >
              <MaterialCommunityIcons name="download" size={32} color={colors.gray} />
              <Text style={styles.quickAccessText}>下载</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessItem}
              onPress={() => { loadBookmarks(); setShowBookmarkDialog(true); }}
            >
              <MaterialCommunityIcons name="bookmark-multiple" size={32} color={colors.accent} />
              <Text style={styles.quickAccessText}>收藏</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 书签 */}
        {bookmarks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>收藏夹</Text>
            <Card style={styles.bookmarksCard}>
              {bookmarks.map(renderBookmarkItem)}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* 收藏路径列表对话框 */}
      <Portal>
        <Dialog visible={showBookmarkDialog} onDismiss={() => setShowBookmarkDialog(false)}>
          <Dialog.Title>收藏的路径</Dialog.Title>
          <Dialog.Content>
            {bookmarks.length === 0 ? (
              <Text style={{ color: colors.gray, textAlign: 'center', paddingVertical: 20 }}>
                暂无收藏，在文件浏览中点击书签图标即可收藏
              </Text>
            ) : (
              bookmarks.map(bookmark => (
                <List.Item
                  key={bookmark.id}
                  title={bookmark.name}
                  description={bookmark.path}
                  left={props => <List.Icon {...props} icon="bookmark" />}
                  onPress={() => {
                    setShowBookmarkDialog(false);
                    handleBookmarkPress(bookmark);
                  }}
                  right={props => (
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => {
                        const newBookmarks = bookmarks.filter(b => b.id !== bookmark.id);
                        setBookmarks(newBookmarks);
                        AsyncStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
                      }}
                    />
                  )}
                />
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowBookmarkDialog(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 存储信息对话框 */}
      <Portal>
        <Dialog visible={showStorageInfo} onDismiss={() => setShowStorageInfo(false)}>
          <Dialog.Title>存储信息</Dialog.Title>
          <Dialog.Content>
            {selectedStorage && (
              <View>
                <Text style={styles.infoLabel}>名称: {selectedStorage.name}</Text>
                <Text style={styles.infoLabel}>路径: {selectedStorage.path}</Text>
                <Text style={styles.infoLabel}>类型: {selectedStorage.type}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowStorageInfo(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.black,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.black,
  },
  storageCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  storageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  storageCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storageName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.black,
  },
  storagePath: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  quickAccessItem: {
    width: '33.33%',
    padding: 8,
    alignItems: 'center',
  },
  quickAccessText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.black,
  },
  bookmarksCard: {
    borderRadius: 8,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: colors.black,
  },
});

export default HomeScreen;
