import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import {
  Text,
  Searchbar,
  Appbar,
  ActivityIndicator,
  Chip,
  Card,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { FileItem, FileType, SearchOptions } from '../types';
import FileService from '../services/FileService';
import { colors } from '../constants/theme';
import { getFileIcon, getFileIconColor, formatFileSize } from '../utils/fileUtils';
import RNFS from 'react-native-fs';

const SearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<FileType[]>([]);
  const [searchPath, setSearchPath] = useState(
    RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0'
  );

  const fileTypes = [
    { type: FileType.IMAGE, label: '图片', icon: 'image' },
    { type: FileType.VIDEO, label: '视频', icon: 'video' },
    { type: FileType.AUDIO, label: '音乐', icon: 'music' },
    { type: FileType.DOCUMENT, label: '文档', icon: 'file-document' },
    { type: FileType.APK, label: '安装包', icon: 'android' },
    { type: FileType.ARCHIVE, label: '压缩包', icon: 'zip-box' },
  ];

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    setIsSearching(true);
    setResults([]);

    // 保存搜索历史
    if (!searchHistory.includes(searchQuery)) {
      const newHistory = [searchQuery, ...searchHistory].slice(0, 10);
      setSearchHistory(newHistory);
    }

    try {
      const options: SearchOptions = {
        query: searchQuery,
        searchInPath: true,
        caseSensitive: false,
        searchRecursively: true,
        fileTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      };

      const searchResults = await FileService.search(searchPath, options, (progress) => {
        setResults([...progress]);
      });

      setResults(searchResults);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedTypes, searchPath, searchHistory]);

  const handleHistoryPress = (query: string) => {
    setSearchQuery(query);
    handleSearch();
  };

  const toggleFileType = (type: FileType) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
    // 如果已有搜索词，切换筛选后自动重新搜索
    if (searchQuery.trim()) {
      setTimeout(() => handleSearch(), 100);
    }
  };

  const handleFilePress = (item: FileItem) => {
    if (item.isDirectory) {
      // 文件夹：直接进入该目录
      (navigation as any).navigate('FileBrowser', {
        path: item.path,
        title: item.name,
      });
    } else {
      // 文件：导航到文件所在的目录，由用户自行操作
      const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
      const parentName = parentPath.substring(parentPath.lastIndexOf('/') + 1);
      (navigation as any).navigate('FileBrowser', {
        path: parentPath,
        title: parentName,
        highlightFile: item.name, // 传递文件名，可用于高亮显示
      });
    }
  };

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
        <Text style={styles.filePath} numberOfLines={1}>{item.path}</Text>
        <Text style={styles.fileDetails}>
          {item.isDirectory ? '文件夹' : formatFileSize(item.size)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleHistoryPress(item)}
    >
      <MaterialCommunityIcons name="history" size={20} color={colors.gray} />
      <Text style={styles.historyText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="搜索文件..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchBar}
        />
      </View>

      {/* 文件类型筛选 */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={fileTypes}
          keyExtractor={(item) => item.type}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Chip
              selected={selectedTypes.includes(item.type)}
              onPress={() => toggleFileType(item.type)}
              style={[
                styles.filterChip,
                selectedTypes.includes(item.type) && styles.filterChipSelected,
              ]}
              icon={item.icon}
            >
              {item.label}
            </Chip>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>正在搜索...</Text>
          <Text style={styles.resultCount}>已找到 {results.length} 个结果</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.path}
          renderItem={renderFileItem}
          contentContainerStyle={styles.resultList}
          ListHeaderComponent={
            <Text style={styles.resultHeader}>找到 {results.length} 个结果</Text>
          }
        />
      ) : searchQuery === '' ? (
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>搜索历史</Text>
          {searchHistory.length > 0 ? (
            <FlatList
              data={searchHistory}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderHistoryItem}
            />
          ) : (
            <Text style={styles.emptyText}>输入关键词开始搜索</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-search-outline" size={64} color={colors.gray} />
          <Text style={styles.emptyText}>没有找到匹配的文件</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.white,
  },
  searchBar: {
    elevation: 2,
  },
  filterContainer: {
    backgroundColor: colors.white,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  filterList: {
    paddingHorizontal: 12,
  },
  filterChip: {
    marginHorizontal: 4,
  },
  filterChipSelected: {
    backgroundColor: colors.primary + '20',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  resultCount: {
    marginTop: 8,
    fontSize: 14,
    color: colors.primary,
  },
  resultList: {
    padding: 8,
  },
  resultHeader: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 8,
    paddingHorizontal: 8,
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
  filePath: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  fileDetails: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    color: colors.black,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.white,
    marginVertical: 4,
    borderRadius: 8,
  },
  historyText: {
    marginLeft: 12,
    fontSize: 14,
    color: colors.black,
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
});

export default SearchScreen;
