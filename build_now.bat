@echo off
set JAVA_HOME=E:\Java17
set ANDROID_HOME=C:\Android\SDK
cd /d D:\MasterFileManager
echo Building JS bundle...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
if errorlevel 1 (
    echo Bundle failed!
    exit /b 1
)
echo Building APK...
call npx react-native run-android --mode=release
echo Done!
