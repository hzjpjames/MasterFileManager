# 安装和测试指南

## 环境准备

### 1. 检查环境

在开始之前，请确保您的系统已安装以下软件：

```bash
# 检查Node.js版本（需要>=18）
node -v
# 应该显示 v22.16.0

# 检查Java版本（需要JDK 17）
java -version
# 应该显示 17.0.13+11

# 检查Android SDK
echo %ANDROID_HOME%
# 应该显示 D:\Android\Sdk

# 检查adb
adb version
```

### 2. 配置环境变量

确保以下环境变量已正确设置：

```bash
# Java
JAVA_HOME=E:\Program Files\Java\jdk-17.0.13+11

# Android SDK
ANDROID_HOME=D:\Android\Sdk

# Gradle
GRADLE_USER_HOME=H:\GradleHome
```

## 安装依赖

### 方法一：使用pnpm（推荐）

```bash
cd D:\MasterFileManager
pnpm install
```

### 方法二：使用npm

```bash
cd D:\MasterFileManager
npm install
```

## 运行项目

### 1. 启动Metro Bundler

```bash
cd D:\MasterFileManager
pnpm start
```

或者

```bash
npx react-native start
```

### 2. 运行Android应用

在另一个终端窗口中：

```bash
cd D:\MasterFileManager
pnpm android
```

或者

```bash
npx react-native run-android
```

## 构建APK

### Debug版本

#### 方法一：使用构建脚本

双击运行 `build-debug.bat`

#### 方法二：手动构建

```bash
cd D:\MasterFileManager\android
gradlew assembleDebug
```

APK输出位置：`android\app\build\outputs\apk\debug\app-debug.apk`

### Release版本

#### 方法一：使用构建脚本

双击运行 `build-release.bat`

#### 方法二：手动构建

```bash
cd D:\MasterFileManager\android
gradlew assembleRelease
```

APK输出位置：`android\app\build\outputs\apk\release\app-release.apk`

## 创建签名密钥

首次构建Release版本需要创建签名密钥：

```bash
cd D:\MasterFileManager\android\app

keytool -genkeypair -v ^
  -storetype PKCS12 ^
  -keystore master-file-manager.keystore ^
  -alias master-file-manager ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000
```

按提示输入：
- 密钥库口令
- 姓名、组织单位、组织、城市、省份、国家代码
- 确认信息

然后在 `android/gradle.properties` 中添加：

```properties
MYAPP_RELEASE_STORE_FILE=master-file-manager.keystore
MYAPP_RELEASE_KEY_ALIAS=master-file-manager
MYAPP_RELEASE_STORE_PASSWORD=你的密钥库口令
MYAPP_RELEASE_KEY_PASSWORD=你的密钥口令
```

## 安装APK到设备

### 方法一：使用adb

```bash
# 连接设备
adb devices

# 安装APK
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### 方法二：手动安装

1. 将APK文件传输到手机
2. 在手机上打开APK文件
3. 允许安装未知来源应用
4. 完成安装

## 测试功能

### 1. 存储权限测试

首次启动应用时：
1. 应用会请求存储权限
2. 点击"允许"授予权限
3. 如果使用Android 11+，需要授予"所有文件访问"权限

### 2. 文件浏览测试

1. 点击"内部存储"
2. 浏览文件夹
3. 点击文件夹进入
4. 点击返回按钮返回上级目录

### 3. 文件操作测试

#### 新建文件夹
1. 点击右上角菜单
2. 选择"新建文件夹"
3. 输入名称
4. 点击"创建"

#### 重命名
1. 长按文件/文件夹
2. 进入选择模式
3. 点击重命名图标
4. 输入新名称
5. 点击"确定"

#### 复制/剪切/粘贴
1. 长按文件进入选择模式
2. 点击复制或剪切图标
3. 导航到目标文件夹
4. 点击菜单 > 粘贴

#### 删除
1. 长按文件进入选择模式
2. 点击删除图标
3. 确认删除

### 4. 搜索测试

1. 切换到"搜索"标签
2. 输入搜索关键词
3. 点击搜索按钮
4. 查看搜索结果

### 5. 分类浏览测试

1. 切换到"分类"标签
2. 点击不同分类（图片、视频、音乐等）
3. 查看分类文件列表

### 6. 文本编辑测试

1. 找到一个.txt文件
2. 点击打开
3. 编辑内容
4. 点击保存图标

### 7. 图片预览测试

1. 找到一张图片
2. 点击打开
3. 查看图片预览

### 8. 视频播放测试

1. 找到一个视频文件
2. 点击打开
3. 观看视频

### 9. SMB连接测试

1. 在首页点击"网络存储 (SMB)"
2. 输入服务器地址（如：192.168.1.100）
3. 输入共享名称
4. 输入用户名和密码（如果需要）
5. 点击"连接"

## 常见问题

### 1. 构建失败：Could not find tools.jar

**解决方案**：
确保JAVA_HOME指向JDK而非JRE：
```bash
set JAVA_HOME=E:\Program Files\Java\jdk-17.0.13+11
```

### 2. 构建失败：SDK location not found

**解决方案**：
创建 `android/local.properties` 文件：
```properties
sdk.dir=D\:\\Android\\Sdk
```

### 3. 运行失败：Unable to load script

**解决方案**：
```bash
# 清理缓存
npx react-native start --reset-cache
```

### 4. 权限问题

**解决方案**：
在Android 11+上，需要手动授予"所有文件访问"权限：
1. 设置 > 应用 > 大师文件管理器 > 权限
2. 启用"允许管理所有文件"

### 5. Metro Bundler无法启动

**解决方案**：
```bash
# 清理node_modules并重新安装
rm -rf node_modules
pnpm install

# 清理Metro缓存
npx react-native start --reset-cache
```

## 调试技巧

### 查看日志

```bash
# 查看所有日志
adb logcat

# 只看应用日志
adb logcat | grep MasterFileManager

# 只看React Native日志
adb logcat ReactNativeJS:V *:S
```

### 摇晃设备打开开发者菜单

```bash
adb shell input keyevent 82
```

### 重新加载应用

在开发者菜单中选择"Reload"，或按两次R键。

## 性能优化建议

1. **启用Hermes**：已在项目中默认启用
2. **使用ProGuard**：Release构建已启用代码混淆
3. **优化图片**：使用适当大小的图片资源
4. **懒加载**：大列表使用FlatList的懒加载功能

## 发布检查清单

- [ ] 更新版本号（app.json和build.gradle）
- [ ] 更新CHANGELOG
- [ ] 测试所有核心功能
- [ ] 测试不同Android版本（至少测试Android 11和Android 14）
- [ ] 测试不同屏幕尺寸
- [ ] 检查权限请求流程
- [ ] 检查应用图标和启动画面
- [ ] 使用Release签名构建APK
- [ ] 测试Release APK安装和运行
