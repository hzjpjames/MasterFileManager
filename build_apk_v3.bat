@echo off
set PATH=E:\Java17\bin;%PATH%
cd /d %~dp0android
call gradlew.bat assembleRelease --no-daemon -Dorg.gradle.jvmargs=-Xmx2048m
echo BUILD_EXIT_CODE=%ERRORLEVEL%
