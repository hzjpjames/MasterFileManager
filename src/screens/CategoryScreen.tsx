import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Appbar,
  ActivityIndicator,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { FileItem, FileType } from '../types';
import FileService from '../services/FileService';
import FileOpener from '../services/FileOpener';
import { colors } from '../constants/theme';
import { getFileType, getFileIcon, getFileIconColor, formatFileSize, getMimeType } from '../utils/fileUtils';
import RNFS from 'react-native-fs';

type CategoryRouteParams = {
  Category: {
    type?: string;
  };
};

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  type: FileType;
}

const CategoryScreen: React.FC = () => {
  const route = useRoute<RouteProp<CategoryRouteParams, 'Category'>>();
  const navigation = useNavigation();
  const { type } = route.params || {};

  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: 'images', name: '图片', icon: 'image-multiple', color: colors.image, count: 0, type: FileType.IMAGE },
    { id: 'videos', name: '视频', icon: 'video', color: colors.video, count: 0, type: FileType.VIDEO },
    { id: 'music', name: '音乐', icon: 'music', color: colors.music, count: 0, type: FileType.AUDIO },
    { id: 'documents', name: '文档', icon: 'file-document-multiple', color: colors.document, count: 0, type: FileType.DOCUMENT },
    { id: 'apks', name: '安装包', icon: 'android', color: colors.apk, count: 0, type: FileType.APK },
    { id: 'archives', name: '压缩包', icon: 'zip-box', color: colors.archive, count: 0, type: FileType.ARCHIVE },
    { id: 'downloads', name: '下载', icon: 'download', color: colors.gray, count: 0, type: FileType.OTHER },
  ]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FileType | null>(null);

  useEffect(() => {
    if (type) {
      const category = categories.find(c => c.id === type);
      if (category) {
        handleCategoryPress(category);
      }
    }
  }, [type]);

  const handleCategoryPress = async (category: CategoryItem) => {
    setSelectedCategory(category.type);
    setIsLoading(true);
    
    try {
      const storagePath = RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0';
      const allFiles = await scanForFiles(storagePath, category.type);
      setFiles(allFiles);
    } catch (error) {
      console.error('扫描文件失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scanForFiles = async (path: string, fileType: FileType): Promise<FileItem[]> => {
    const results: FileItem[] = [];
    
    const scan = async (dirPath: string) => {
      try {
        const items = await RNFS.readDir(dirPath);
        for (const item of items) {
          if (item.isDirectory()) {
            await scan(item.path);
          } else {
            const type = getFileType(item.name, false);
            if (type === fileType) {
              results.push({
                name: item.name,
                path: item.path,
                isDirectory: false,
                size: item.size || 0,
                modifiedTime: item.mtime || 0,
                type,
                extension: item.name.split('.').pop(),
              });
            }
          }
        }
      } catch (e) {
        // 忽略无权限目录
      }
    };

    await scan(path);
    return results;
  };

  const handleFilePress = (item: FileItem) => {
    // 图片用内置查看器
    if (item.type === FileType.IMAGE) {
      (navigation as any).navigate('ImageViewer', { path: item.path, currentDir: item.path.substring(0, item.path.lastIndexOf('/')) });
      return;
    }
    // 只有 .txt 文件才用内置编辑器，其他文档类型用系统选择器
    const ext = (item.name.split('.').pop() || '').toLowerCase();
    if (ext === 'txt') {
      (navigation as any).navigate('TextEditor', { path: item.path });
      return;
    }
    // 文档类型（doc/xls/ppt/pdf）用选择器让用户选打开方式
    const docExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'rtf', 'odt', 'ods', 'odp'];
    if (docExtensions.includes(ext)) {
      const mime = getMimeType(item.name);
      FileOpener.openFileWithChooser(item.path, mime).catch(() => {});
      return;
    }
    // 视频/音频/APK/压缩包/其他 → 系统应用打开
    const mime = getMimeType(item.name);
    FileOpener.openFile(item.path, mime).catch((err: any) => {
      console.error('[Category] openFile error:', err?.message || err);
    });
  };

  const renderCategoryItem = ({ item }: { item: CategoryItem }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(item)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color + '20' }]}>
        <MaterialCommunityIcons name={item.icon} size={32} color={item.color} />
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
      <Text style={styles.categoryCount}>{item.count} 项</Text>
    </TouchableOpacity>
  );

  const renderFileItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={() => handleFilePress(item)}
    >
      <MaterialCommunityIcons
        name={getFileIcon(item)}
        size={40}
        color={getFileIconColor(item)}
      />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.fileDetails}>
          {formatFileSize(item.size)} • {item.path.split('/').slice(-2, -1)[0]}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (selectedCategory) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => setSelectedCategory(null)} />
          <Appbar.Content title={categories.find(c => c.type === selectedCategory)?.name || '文件'} />
        </Appbar.Header>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>正在扫描文件...</Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-outline" size={64} color={colors.gray} />
            <Text style={styles.emptyText}>没有找到文件</Text>
          </View>
        ) : (
          <FlatList
            data={files}
            keyExtractor={(item) => item.path}
            renderItem={renderFileItem}
            contentContainerStyle={styles.fileList}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategoryItem}
        numColumns={2}
        contentContainerStyle={styles.categoryList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  categoryList: {
    padding: 16,
  },
  categoryCard: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.black,
  },
  categoryCount: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.gray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  fileList: {
    padding: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.white,
    marginVertical: 4,
    borderRadius: 8,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    color: colors.black,
  },
  fileDetails: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
});

export default CategoryScreen;
