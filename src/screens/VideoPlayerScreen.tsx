import React from 'react';
import { View, Text } from 'react-native';
import { Appbar } from 'react-native-paper';

const VideoPlayerScreen: React.FC = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => {}} />
        <Appbar.Content title="视频播放" />
      </Appbar.Header>
      <Text>视频播放功能已移除</Text>
    </View>
  );
};

export default VideoPlayerScreen;