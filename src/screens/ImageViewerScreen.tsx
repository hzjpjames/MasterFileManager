import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from 'react-native';
import {
  Text,
  Appbar,
  Menu,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import RNFS from 'react-native-fs';
import FileService from '../services/FileService';
import FileOpener from '../services/FileOpener';
import { colors } from '../constants/theme';

type ImageViewerRouteParams = {
  ImageViewer: {
    path: string;
    currentDir?: string;
  };
};

const ImageViewerScreen: React.FC = () => {
  const route = useRoute<RouteProp<ImageViewerRouteParams, 'ImageViewer'>>();
  const navigation = useNavigation();
  const { path, currentDir } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);

  const { width, height } = Dimensions.get('window');

  const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

  useEffect(() => {
    loadImages();
  }, [path]);

  const loadImages = async () => {
    setIsLoading(true);
    setError(false);

    if (currentDir) {
      // 加载同目录所有图片，支持左右滑动
      try {
        const items = await FileService.listDirectory(currentDir);
        const imageFiles = items
          .filter((f: any) => !f.isDirectory)
          .filter((f: any) => {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            return IMAGE_EXTENSIONS.includes(ext);
          })
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
          .map((f: any) => f.path);

        const startIdx = imageFiles.indexOf(path);
        setImages(imageFiles);
        setCurrentIndex(startIdx >= 0 ? startIdx : 0);
      } catch (e) {
        // fallback：只显示当前图片
        setImages([path]);
      }
    } else {
      setImages([path]);
    }
    setIsLoading(false);
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await FileOpener.shareFile(images[currentIndex], 'image/*');
    } catch (e: any) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('分享失败', ToastAndroid.SHORT);
      }
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="图片查看" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>无法加载图片</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="图片查看" />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />
          }
        >
          <Menu.Item onPress={handleShare} title="分享" leadingIcon="share-variant" />
        </Menu>
      </Appbar.Header>

      <View style={styles.imageContainer}>
        <FlatList
          data={images}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentIndex >= 0 && currentIndex < images.length ? currentIndex : 0}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / width
            );
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <View style={{ width, height: height - 56 }}>
              <FastImage
                source={{ uri: `file://${item}` }}
                style={styles.image}
                resizeMode={FastImage.resizeMode.contain}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  if (images.length === 1) setError(true);
                }}
              />
            </View>
          )}
        />
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>

      {images.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  counter: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterText: {
    color: colors.white,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});

export default ImageViewerScreen;
