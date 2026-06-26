import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { FileItem } from '../types';
import FileListItem from './FileListItem';
import { colors } from '../constants/theme';

interface FileListProps {
  files: FileItem[];
  isLoading: boolean;
  isSelectionMode: boolean;
  selectedItems: Set<string>;
  viewMode: 'list' | 'grid';
  onFilePress: (item: FileItem) => void;
  onFileLongPress: (item: FileItem) => void;
  onToggleSelect: (item: FileItem) => void;
  onRefresh?: () => void;
  emptyMessage?: string;
}

const FileList: React.FC<FileListProps> = ({
  files,
  isLoading,
  isSelectionMode,
  selectedItems,
  viewMode,
  onFilePress,
  onFileLongPress,
  onToggleSelect,
  onRefresh,
  emptyMessage = '空文件夹',
}) => {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const numColumns = viewMode === 'grid' ? 3 : 1;

  return (
    <FlatList
      data={files}
      keyExtractor={(item) => item.path}
      numColumns={numColumns}
      key={viewMode} // 切换视图模式时重新渲染
      renderItem={({ item }) => (
        <FileListItem
          item={item}
          isSelected={selectedItems.has(item.path)}
          isSelectionMode={isSelectionMode}
          viewMode={viewMode}
          onPress={() => onFilePress(item)}
          onLongPress={() => onFileLongPress(item)}
          onToggleSelect={() => onToggleSelect(item)}
        />
      )}
      contentContainerStyle={viewMode === 'grid' ? styles.gridContent : styles.listContent}
      onRefresh={onRefresh}
      refreshing={isLoading}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: colors.gray,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray,
  },
  listContent: {
    flexGrow: 1,
  },
  gridContent: {
    flexGrow: 1,
    padding: 4,
  },
});

export default FileList;
