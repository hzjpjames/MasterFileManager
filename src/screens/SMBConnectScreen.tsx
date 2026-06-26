import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  TextInput,
  Button,
  Card,
  List,
  Dialog,
  Portal,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SMBService from '../services/SMBService';
import { SMBConfig } from '../types';
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SMBConnectScreen: React.FC = () => {
  const navigation = useNavigation();

  const [server, setServer] = useState('');
  const [port, setPort] = useState('445');
  const [share, setShare] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [savedConnections, setSavedConnections] = useState<SMBConfig[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<SMBConfig | null>(null);

  React.useEffect(() => {
    loadSavedConnections();
  }, []);

  const loadSavedConnections = async () => {
    try {
      const saved = await AsyncStorage.getItem('smb_connections');
      if (saved) {
        setSavedConnections(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载保存的连接失败:', e);
    }
  };

  const handleConnect = async () => {
    if (!server.trim()) {
      Alert.alert('错误', '请输入服务器地址');
      return;
    }

    if (!share.trim()) {
      Alert.alert('错误', '请输入共享名称');
      return;
    }

    setIsConnecting(true);

    try {
      const config: SMBConfig = {
        id: Date.now().toString(),
        name: connectionName || server,
        server: server.trim(),
        port: parseInt(port) || 445,
        share: share.trim(),
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        domain: domain.trim() || undefined,
      };

      await SMBService.connect(config);

      // 保存连接
      const newConnections = [...savedConnections, config];
      await AsyncStorage.setItem('smb_connections', JSON.stringify(newConnections));
      setSavedConnections(newConnections);

      // 导航到文件浏览器
      (navigation as any).navigate('FileBrowser', {
        path: `smb://${server}/${share}`,
        title: config.name,
      });

      // 清空表单
      setServer('');
      setShare('');
      setUsername('');
      setPassword('');
      setConnectionName('');
    } catch (error: any) {
      Alert.alert('连接失败', error.message || '无法连接到服务器');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSaved = async (config: SMBConfig) => {
    setIsConnecting(true);
    try {
      await SMBService.connect(config);
      (navigation as any).navigate('FileBrowser', {
        path: `smb://${config.server}/${config.share}`,
        title: config.name,
      });
    } catch (error: any) {
      Alert.alert('连接失败', error.message || '无法连接到服务器');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!selectedConnection) return;

    const newConnections = savedConnections.filter(c => c.id !== selectedConnection.id);
    await AsyncStorage.setItem('smb_connections', JSON.stringify(newConnections));
    setSavedConnections(newConnections);
    setShowDeleteDialog(false);
    setSelectedConnection(null);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="连接网络存储" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* 新建连接 */}
        <Card style={styles.card}>
          <Card.Title
            title="新建连接"
            left={(props) => (
              <MaterialCommunityIcons {...props} name="lan-connect" />
            )}
          />
          <Card.Content>
            <TextInput
              label="连接名称（可选）"
              value={connectionName}
              onChangeText={setConnectionName}
              mode="outlined"
              style={styles.input}
              placeholder="例如：公司NAS"
            />

            <TextInput
              label="服务器地址 *"
              value={server}
              onChangeText={setServer}
              mode="outlined"
              style={styles.input}
              placeholder="例如：192.168.1.100 或 server.local"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="端口"
              value={port}
              onChangeText={setPort}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="共享名称 *"
              value={share}
              onChangeText={setShare}
              mode="outlined"
              style={styles.input}
              placeholder="例如：Public"
              autoCapitalize="none"
            />

            <TextInput
              label="用户名（可选）"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="密码（可选）"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
              secureTextEntry
            />

            <TextInput
              label="域（可选）"
              value={domain}
              onChangeText={setDomain}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
            />

            <Button
              mode="contained"
              onPress={handleConnect}
              loading={isConnecting}
              disabled={isConnecting}
              style={styles.button}
            >
              连接
            </Button>
          </Card.Content>
        </Card>

        {/* 已保存的连接 */}
        {savedConnections.length > 0 && (
          <Card style={styles.card}>
            <Card.Title
              title="已保存的连接"
              left={(props) => (
                <MaterialCommunityIcons {...props} name="bookmark" />
              )}
            />
            <Card.Content>
              {savedConnections.map((connection) => (
                <List.Item
                  key={connection.id}
                  title={connection.name}
                  description={`${connection.server}/${connection.share}`}
                  left={(props) => (
                    <List.Icon {...props} icon="server-network" />
                  )}
                  right={(props) => (
                    <View style={styles.connectionActions}>
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => {
                          setSelectedConnection(connection);
                          setShowDeleteDialog(true);
                        }}
                      />
                    </View>
                  )}
                  onPress={() => handleConnectSaved(connection)}
                  style={styles.connectionItem}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 帮助信息 */}
        <Card style={styles.card}>
          <Card.Title
            title="使用帮助"
            left={(props) => (
              <MaterialCommunityIcons {...props} name="help-circle" />
            )}
          />
          <Card.Content>
            <Text style={styles.helpText}>
              1. 确保您的设备和目标服务器在同一局域网{'\n'}
              2. 输入服务器的IP地址或主机名{'\n'}
              3. 输入共享文件夹的名称{'\n'}
              4. 如果需要，输入用户名和密码{'\n'}
              5. 点击连接按钮进行连接
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* 删除确认对话框 */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>删除连接</Dialog.Title>
          <Dialog.Content>
            <Text>确定要删除此连接吗？</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>取消</Button>
            <Button onPress={handleDeleteConnection} textColor={colors.error}>
              删除
            </Button>
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
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  connectionItem: {
    paddingVertical: 8,
  },
  connectionActions: {
    flexDirection: 'row',
  },
  helpText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.gray,
  },
});

export default SMBConnectScreen;
