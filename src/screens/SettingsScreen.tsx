import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  DeviceEventEmitter,
  ToastAndroid,
} from 'react-native';
import {
  Text,
  List,
  Switch,
  Divider,
  Dialog,
  Portal,
  Button,
} from 'react-native-paper';
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen: React.FC = () => {
  const [showHidden, setShowHidden] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [autoPlayVideo, setAutoPlayVideo] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const toggleShowHidden = async (value: boolean) => {
    setShowHidden(value);
    await AsyncStorage.setItem('showHidden', value.toString());
  };

  const toggleShowThumbnails = async (value: boolean) => {
    setShowThumbnails(value);
    await AsyncStorage.setItem('showThumbnails', value.toString());
  };

  const toggleAutoPlayVideo = async (value: boolean) => {
    setAutoPlayVideo(value);
    await AsyncStorage.setItem('autoPlayVideo', value.toString());
  };

  const toggleConfirmDelete = async (value: boolean) => {
    setConfirmDelete(value);
    await AsyncStorage.setItem('confirmDelete', value.toString());
  };

  const handleClearCache = async () => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  };

  const handleRefreshStorage = () => {
    DeviceEventEmitter.emit('REFRESH_STORAGE');
    ToastAndroid.show('已通知首页刷新存储设备', ToastAndroid.SHORT);
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <List.Section>
          <List.Subheader>显示设置</List.Subheader>
          <List.Item
            title="显示隐藏文件"
            description="显示以点开头的文件和文件夹"
            left={(props) => <List.Icon {...props} icon="eye-outline" />}
            right={() => (
              <Switch
                value={showHidden}
                onValueChange={toggleShowHidden}
              />
            )}
          />
          <List.Item
            title="显示缩略图"
            description="显示图片和视频的缩略图预览"
            left={(props) => <List.Icon {...props} icon="image-outline" />}
            right={() => (
              <Switch
                value={showThumbnails}
                onValueChange={toggleShowThumbnails}
              />
            )}
          />
          <List.Item
            title="自动播放视频"
            description="打开视频时自动开始播放"
            left={(props) => <List.Icon {...props} icon="play-circle-outline" />}
            right={() => (
              <Switch
                value={autoPlayVideo}
                onValueChange={toggleAutoPlayVideo}
              />
            )}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>安全设置</List.Subheader>
          <List.Item
            title="删除前确认"
            description="删除文件时显示确认对话框"
            left={(props) => <List.Icon {...props} icon="delete-outline" />}
            right={() => (
              <Switch
                value={confirmDelete}
                onValueChange={toggleConfirmDelete}
              />
            )}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>存储管理</List.Subheader>
          <List.Item
            title="存储权限"
            description="管理应用的存储访问权限"
            left={(props) => <List.Icon {...props} icon="key-outline" />}
            onPress={handleOpenSettings}
          />
          <List.Item
            title="清除缓存"
            description="清除应用缓存数据"
            left={(props) => <List.Icon {...props} icon="cached" />}
            onPress={handleClearCache}
          />
          <List.Item
            title="刷新存储设备"
            description="首页刷新按钮用于OTG设备"
            left={(props) => <List.Icon {...props} icon="refresh" />}
            onPress={handleRefreshStorage}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>关于</List.Subheader>
          <List.Item
            title="大师文件管理器"
            description="版本 2.2.0"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
            onPress={() => setShowAbout(true)}
          />
          <List.Item
            title="检查更新"
            description="https://gitee.com/hzdongbao/releases"
            descriptionNumberOfLines={1}
            descriptionStyle={{ color: '#1E88E5' }}
            left={(props) => <List.Icon {...props} icon="update" />}
            onPress={() => Linking.openURL('https://gitee.com/hzdongbao/releases')}
          />
          <List.Item
            title="联系作者"
            description="5931731@qq.com"
            left={(props) => <List.Icon {...props} icon="email-outline" />}
            onPress={() => {}}
          />
          <List.Item
            title="隐私政策"
            description="查看应用的隐私条款说明"
            left={(props) => <List.Icon {...props} icon="shield-account-outline" />}
            onPress={() => setShowPrivacy(true)}
          />
          <List.Item
            title="开发者"
            description="江辉剑"
            left={(props) => <List.Icon {...props} icon="account-outline" />}
            onPress={() => {}}
          />
        </List.Section>
      </ScrollView>

      <Portal>
        <Dialog visible={showAbout} onDismiss={() => setShowAbout(false)}>
          <Dialog.Title>关于</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.aboutTitle}>大师文件管理器</Text>
            <Text style={styles.aboutVersion}>版本 2.2.0</Text>
            <Text style={styles.aboutText}>
              一款功能强大的Android文件管理器，支持本地文件管理、网络共享、USB存储访问、文件编辑等功能。
            </Text>
            <Text style={styles.aboutText}>
              {'\u00A9'} 2026 大师文件管理器
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAbout(false)}>确认</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showPrivacy} onDismiss={() => setShowPrivacy(false)}>
          <Dialog.Title>隐私政策</Dialog.Title>
          <Dialog.ScrollArea style={styles.privacyScroll}>
            <ScrollView>
              <View style={styles.privacyContent}>
                <Text style={styles.privacyTitle}>隐私条款声明</Text>
                <Text style={styles.privacyText}>
                  大师文件管理器（以下简称"本应用"）高度重视用户隐私保护。本隐私政策旨在向您说明本应用如何收集、使用和保护您的个人信息。
                </Text>
                <Text style={styles.privacySubtitle}>一、信息收集</Text>
                <Text style={styles.privacyText}>
                  本应用仅访问您设备上的文件系统，用于完成文件浏览、管理、搜索、复制、移动、删除等基本功能。
                  {'\n\n'}
                  具体包括：
                  {'\n'}• 本地存储文件：读取和写入设备内部存储及外部存储中的文件
                  {'\n'}• USB存储设备：访问通过USB OTG连接的移动存储设备
                  {'\n'}• 网络共享文件：通过SMB协议访问局域网共享文件夹
                  {'\n\n'}
                  本应用不会收集、上传或分享您的任何文件内容和个人数据。
                </Text>
                <Text style={styles.privacySubtitle}>二、权限使用说明</Text>
                <Text style={styles.privacyText}>
                  {'\n'}• 存储权限：用于读取和管理您设备上的文件
                  {'\n'}• 网络权限：用于访问局域网SMB共享文件夹
                  {'\n\n'}
                  所有权限仅用于提供核心功能，不会用于其他目的。
                </Text>
                <Text style={styles.privacySubtitle}>三、数据安全</Text>
                <Text style={styles.privacyText}>
                  本应用所有文件操作均在您的设备本地完成，不会通过互联网传输您的任何数据。
                  SMB网络共享仅在您主动配置的局域网内通信，不会发送至外部服务器。
                </Text>
                <Text style={styles.privacySubtitle}>四、第三方服务</Text>
                <Text style={styles.privacyText}>
                  本应用不集成任何第三方统计、广告或追踪服务，不向任何第三方提供您的数据。
                </Text>
                <Text style={styles.privacySubtitle}>五、联系我们</Text>
                <Text style={styles.privacyText}>
                  如对本隐私政策有任何疑问，请联系：
                  {'\n'}邮箱：5931731@qq.com
                </Text>
                <Text style={styles.privacySubtitle}>六、政策更新</Text>
                <Text style={styles.privacyText}>
                  本隐私政策可能适时更新，更新后的政策将在应用内公布。
                  建议您定期查阅以了解最新信息。
                </Text>
                <Text style={styles.privacyDate}>
                  生效日期：2026年6月26日
                </Text>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowPrivacy(false)}>确认</Button>
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
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.gray,
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.black,
    marginTop: 8,
  },
  privacyScroll: {
    maxHeight: 400,
  },
  privacyContent: {
    paddingHorizontal: 8,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: colors.black,
  },
  privacySubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 4,
    color: colors.black,
  },
  privacyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  },
  privacyDate: {
    fontSize: 12,
    textAlign: 'center',
    color: colors.gray,
    marginTop: 16,
  },
});

export default SettingsScreen;
