| 文件 | 修改内容 | 对应问题 |
|---|---|---|
| SMBModule.java | 新增downloadFile()、disconnect()；listShares()复用CIFSContext；listDirectory()返回size/modifiedTime；优化超时参数 | 问题3 + 问题5 |
| MainNavigator.tsx | FileBrowser加gestureEnabled:false | 问题4 |
| FileBrowserScreen.tsx | 新增BackHandler拦截安卓返回手势，逐级回退目录 | 问题4 |
| SMBService.ts | 新增downloadFileByUrl()直接通过SMB URL下载 | 问题5 |
| FileService.ts | copy()检测smb://前缀→copyFromSMB()先下载再复制 | 问题5 |
