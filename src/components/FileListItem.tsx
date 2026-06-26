import React from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Text as RNText 
} from 'react-native';
import { Text, IconButton, Checkbox } from 'react-native-paper';
import { FileItem } from '../types';
import { getFileIcon, getFileIconColor, formatFileSize, formatDate } from '../utils/fileUtils';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../constants/theme';

interface FileItemProps {
  item: FileItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  viewMode: 'list' | 'grid';
  onPress: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
}

const FileListItem: React.FC<FileItemProps> = ({
  item,
  isSelected,
  isSelectionMode,
  viewMode,
  onPress,
  onLongPress,
  onToggleSelect,
}) => {
  const iconName = getFileIcon(item);
  const iconColor = getFileIconColor(item);

  if (viewMode === 'grid') {
    return (
      <TouchableOpacity
        style={[styles.gridItem, isSelected && styles.selectedItem]}
        onPress={isSelectionMode ? onToggleSelect : onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {isSelectionMode && (
          <View style={styles.gridCheckbox}>
            <Checkbox
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={onToggleSelect}
            />
          </View>
        )}
        
        <View style={styles.gridIconContainer}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.gridThumbnail} />
          ) : (
            <MaterialCommunityIcons
              name={iconName}
              size={48}
              color={iconColor}
            />
          )}
        </View>
        
        <Text
          style={styles.gridName}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {item.name}
        </Text>
        
        {!item.isDirectory && (
          <Text style={styles.gridSize}>
            {formatFileSize(item.size)}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.listItem, isSelected && styles.selectedItem]}
      onPress={isSelectionMode ? onToggleSelect : onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {isSelectionMode && (
        <Checkbox
          status={isSelected ? 'checked' : 'unchecked'}
          onPress={onToggleSelect}
        />
      )}
      
      <View style={styles.iconContainer}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        ) : (
          <MaterialCommunityIcons
            name={iconName}
            size={40}
            color={iconColor}
          />
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text
          style={styles.name}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {item.name}
        </Text>
        <View style={styles.details}>
          {!item.isDirectory && (
            <Text style={styles.detailText}>
              {formatFileSize(item.size)} • 
            </Text>
          )}
          <Text style={styles.detailText}>
            {formatDate(item.modifiedTime)}
          </Text>
        </View>
      </View>
      
      <IconButton
        icon="dots-vertical"
        size={20}
        onPress={onLongPress}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // 列表视图样式
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  selectedItem: {
    backgroundColor: '#E3F2FD',
  },
  iconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    color: colors.black,
  },
  details: {
    flexDirection: 'row',
    marginTop: 2,
  },
  detailText: {
    fontSize: 12,
    color: colors.gray,
    marginRight: 4,
  },
  
  // 网格视图样式
  gridItem: {
    width: 100,
    margin: 8,
    padding: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  gridCheckbox: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  gridIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 4,
  },
  gridName: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    color: colors.black,
  },
  gridSize: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
  },
});

export default FileListItem;
