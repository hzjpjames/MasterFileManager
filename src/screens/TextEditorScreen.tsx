import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Text,
} from 'react-native';
import {
  TextInput,
  Appbar,
  Snackbar,
  ActivityIndicator,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import FileService from '../services/FileService';
import { colors } from '../constants/theme';

type TextEditorRouteParams = {
  TextEditor: {
    path: string;
  };
};

const TextEditorScreen: React.FC = () => {
  const route = useRoute<RouteProp<TextEditorRouteParams, 'TextEditor'>>();
  const navigation = useNavigation();
  const { path } = route.params;

  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBinaryPreview, setIsBinaryPreview] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selection, setSelection] = useState<{start: number, end: number}>({start: 0, end: 0});
  
  const editTextInputRef = useRef<any>(null);
  const readScrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadFile();
  }, [path]);

  // 模式切换或加载完成后，设置光标位置和滚动
  useEffect(() => {
    if (!isLoading && content.length > 0) {
      setTimeout(() => {
        if (isEditMode) {
          // 编辑模式：光标在末尾
          setSelection({start: content.length, end: content.length});
          // 延迟聚焦以确保光标可见
          setTimeout(() => {
            editTextInputRef.current?.focus();
          }, 100);
        } else {
          // 只读模式：滚动到顶部
          readScrollViewRef.current?.scrollTo({y: 0, animated: false});
        }
      }, 100);
    }
  }, [isLoading, isEditMode]);

  const loadFile = async () => {
    setIsLoading(true);
    try {
      const text = await FileService.readTextFile(path);
      setContent(text);
      setOriginalContent(text);
      setFileName(path.split('/').pop() || '未命名');
      setIsBinaryPreview(text.startsWith('[二进制文件预览]'));
    } catch (error: any) {
      setSnackbarMessage('加载文件失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await FileService.writeTextFile(path, content);
      setOriginalContent(content);
      setSnackbarMessage('保存成功');
    } catch (error: any) {
      setSnackbarMessage('保存失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoBack = () => {
    if (content !== originalContent) {
      Alert.alert(
        '未保存的更改',
        '您有未保存的更改，是否保存？',
        [
          { text: '不保存', style: 'destructive', onPress: () => navigation.goBack() },
          { text: '取消', style: 'cancel' },
          { text: '保存', onPress: async () => {
            await handleSave();
            navigation.goBack();
          }},
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const hasChanges = content !== originalContent;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={handleGoBack} />
          <Appbar.Content title="加载中..." />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={handleGoBack} />
        <Appbar.Content 
          title={fileName} 
          subtitle={hasChanges ? '未保存' : (isEditMode ? '编辑模式' : '只读')}
        />
        {isBinaryPreview ? null : (
          <Appbar.Action 
            icon={isEditMode ? "eye" : "pencil"} 
            onPress={() => {
              if (!isEditMode) {
                setIsEditMode(true);
              } else {
                setIsEditMode(false);
              }
            }}
          />
        )}
        <Appbar.Action 
          icon="content-save" 
          onPress={handleSave}
          disabled={!hasChanges || isSaving || isBinaryPreview || !isEditMode}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.editorContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isEditMode ? (
          // 编辑模式：使用 TextInput（支持光标和编辑）
          <TextInput
            ref={editTextInputRef}
            value={content}
            onChangeText={setContent}
            multiline
            editable
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            style={[styles.textInput, isBinaryPreview && { fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }]}
            placeholder="开始输入..."
            placeholderTextColor={colors.gray}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          // 只读模式：使用 ScrollView + Text（自由滚动，无光标）
          <ScrollView
            ref={readScrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.textContent, isBinaryPreview && { fontFamily: 'monospace', fontSize: 12, lineHeight: 16 }]}>
              {content}
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage('')}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
  editorContainer: {
    flex: 1,
  },
  textInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.black,
    fontWeight: 'normal',
  },
});

export default TextEditorScreen;
