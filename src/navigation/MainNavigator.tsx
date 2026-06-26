import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import HomeScreen from '../screens/HomeScreen';
import FileBrowserScreen from '../screens/FileBrowserScreen';
import CategoryScreen from '../screens/CategoryScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TextEditorScreen from '../screens/TextEditorScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import VideoPlayerScreen from '../screens/VideoPlayerScreen';
import SMBConnectScreen from '../screens/SMBConnectScreen';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 主标签导航
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Category':
              iconName = 'view-grid';
              break;
            case 'Search':
              iconName = 'magnify';
              break;
            case 'Settings':
              iconName = 'cog';
              break;
            default:
              iconName = 'folder';
          }

          return (
            <MaterialCommunityIcons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: '首页' }}
      />
      <Tab.Screen 
        name="Category" 
        component={CategoryScreen}
        options={{ title: '分类' }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{ title: '搜索' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: '设置' }}
      />
    </Tab.Navigator>
  );
};

// 主导航器
const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="FileBrowser" 
        component={FileBrowserScreen}
        options={({ route }) => ({ 
          title: (route.params as any)?.title || '文件浏览',
          headerShown: false,
          gestureEnabled: false,
        })}
      />
      <Stack.Screen 
        name="TextEditor" 
        component={TextEditorScreen}
        options={{ title: '文本编辑器' }}
      />
      <Stack.Screen 
        name="ImageViewer" 
        component={ImageViewerScreen}
        options={{ title: '图片查看' }}
      />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{ title: '视频播放' }}
      />
      <Stack.Screen 
        name="SMBConnect" 
        component={SMBConnectScreen}
        options={{ title: '连接网络存储', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
