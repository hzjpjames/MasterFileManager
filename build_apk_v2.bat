@echo off
set JAVA_HOME=E:\Java17
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d %~dp0android
call gradlew.bat assembleRelease --no-daemon -Dorg.gradle.jvmargs=-Xmx2048m
echo BUILD_EXIT_CODE=%ERRORLEVEL%
