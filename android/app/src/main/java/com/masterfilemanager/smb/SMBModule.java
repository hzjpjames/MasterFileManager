package com.masterfilemanager.smb;

import android.util.Log;
import android.os.Environment;
import android.os.Build;
import android.content.Intent;
import com.facebook.react.bridge.*;
import jcifs.CIFSContext;
import jcifs.config.PropertyConfiguration;
import jcifs.context.BaseContext;
import jcifs.smb.*;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Properties;

public class SMBModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SMBModule";
    private CIFSContext cifsContext;
    private String currentServer;
    private String currentShare;

    public SMBModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() { return "SMBModule"; }

    @ReactMethod
    public void connect(ReadableMap options, Promise promise) {
        try {
            String server = options.getString("server");
            String username = options.getString("username");
            String password = options.getString("password");
            String share = options.getString("share");
            String domain = options.hasKey("domain") ? options.getString("domain") : null;

            Log.e(TAG, "[connect] server=" + server + " user=" + username + " share=" + share);

            if (domain == null || domain.isEmpty()) {
                domain = ".";
            }

            Properties props = new Properties();
            props.put("jcifs.smb.client.enableSMB2", "true");
            props.put("jcifs.smb.client.enableSMB3", "true");
            props.put("jcifs.smb.client.soTimeout", "30000");
            props.put("jcifs.smb.client.responseTimeout", "30000");
            props.put("jcifs.smb.client.connTimeout", "10000");

            PropertyConfiguration config = new PropertyConfiguration(props);
            NtlmPasswordAuthenticator auth = new NtlmPasswordAuthenticator(domain, username, password);
            cifsContext = (CIFSContext)(new BaseContext(config)).withCredentials(auth);
            currentServer = server;
            currentShare = share;

            String url = "smb://" + server + "/" + share + "/";
            Log.e(TAG, "[connect] Connecting to: " + url);
            SmbFile root = new SmbFile(url, cifsContext);
            boolean exists = root.exists();
            Log.e(TAG, "[connect] exists=" + exists);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[connect] FAILED: " + e.getMessage());
            e.printStackTrace();
            promise.reject("CONNECT_FAILED", e);
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            cifsContext = null;
            currentServer = null;
            currentShare = null;
            Log.e(TAG, "[disconnect] Session cleared");
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DISCONNECT_FAILED", e);
        }
    }

    @ReactMethod
    public void listDirectory(String path, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }
            String url = path.startsWith("smb://") ? path : "smb://" + path;
            if (!url.endsWith("/")) url += "/";
            Log.e(TAG, "[listDirectory] url=" + url);

            SmbFile dir = new SmbFile(url, cifsContext);
            SmbFile[] files = dir.listFiles();
            if (files == null) {
                promise.resolve(new WritableNativeArray());
                return;
            }
            Log.e(TAG, "[listDirectory] found " + files.length + " items");

            WritableArray result = new WritableNativeArray();
            // 确保父目录URL以/结尾
            String parentUrl = url;
            if (!parentUrl.endsWith("/")) parentUrl += "/";
            for (SmbFile f : files) {
                WritableNativeMap m = new WritableNativeMap();
                String name = f.getName();
                if (name.endsWith("/")) name = name.substring(0, name.length() - 1);
                m.putString("name", name);
                boolean isDir = f.isDirectory();
                m.putBoolean("isDirectory", isDir);
                // 修复：用父URL+文件名拼接路径，避免f.getPath()含share前缀导致重复
                String childUrl = parentUrl + name;
                if (isDir) childUrl += "/";
                m.putString("path", childUrl);
                // 返回扩展名用于前端类型判断
                if (!isDir) {
                    int dot = name.lastIndexOf('.');
                    String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
                    m.putString("extension", ext);
                } else {
                    m.putString("extension", "");
                }
                // 获取文件大小和修改时间（文件才需要大小）
                try {
                    if (!isDir) {
                        m.putDouble("size", f.length());
                    } else {
                        m.putDouble("size", 0);
                    }
                    m.putDouble("modifiedTime", f.lastModified());
                } catch (Exception ex) {
                    m.putDouble("size", 0);
                    m.putDouble("modifiedTime", System.currentTimeMillis());
                }
                result.pushMap(m);
            }
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "[listDirectory] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("LIST_FAILED", e);
        }
    }

    @ReactMethod
    public void listShares(String server, String username, String password, Promise promise) {
        try {
            // Reuse cached CIFSContext if already connected to this server
            CIFSContext ctx;
            if (cifsContext != null && server.equals(currentServer)) {
                Log.e(TAG, "[listShares] Reusing cached context for " + server);
                ctx = cifsContext;
            } else {
                Log.e(TAG, "[listShares] Creating new context for " + server);
                String domain = ".";
                Properties props = new Properties();
                props.put("jcifs.smb.client.enableSMB2", "true");
                props.put("jcifs.smb.client.enableSMB3", "true");
                props.put("jcifs.smb.client.connTimeout", "10000");
                PropertyConfiguration config = new PropertyConfiguration(props);
                NtlmPasswordAuthenticator auth =
                    new NtlmPasswordAuthenticator(domain, username, password);
                ctx = (CIFSContext)(new BaseContext(config)).withCredentials(auth);
            }

            String url = "smb://" + server + "/";
            SmbFile root = new SmbFile(url, ctx);
            SmbFile[] shares = root.listFiles();
            if (shares == null) {
                promise.resolve(new WritableNativeArray());
                return;
            }
            Log.e(TAG, "[listShares] found " + shares.length + " shares");

            WritableArray result = new WritableNativeArray();
            for (SmbFile s : shares) {
                WritableNativeMap m = new WritableNativeMap();
                m.putString("name", s.getName());
                m.putBoolean("isDirectory", true);
                m.putString("path", "smb://" + s.getServer() + "/" + s.getName());
                result.pushMap(m);
            }
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "[listShares] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("LIST_SHARES_FAILED", e);
        }
    }

    @ReactMethod
    public void rename(String oldPath, String newName, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }
            String url = oldPath.startsWith("smb://") ? oldPath : "smb://" + oldPath;
            boolean isDir = url.endsWith("/");
            int lastSlash = url.lastIndexOf('/', url.length() - (isDir ? 2 : 1));
            String parentUrl = url.substring(0, lastSlash + 1);
            String newUrl = parentUrl + newName + (isDir ? "/" : "");

            Log.e(TAG, "[rename] " + url + " → " + newUrl);

            SmbFile src = new SmbFile(url, cifsContext);
            SmbFile dst = new SmbFile(newUrl, cifsContext);
            src.renameTo(dst);
            Log.e(TAG, "[rename] SUCCESS");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[rename] ERROR: " + e.getMessage());
            promise.reject("RENAME_FAILED", e);
        }
    }

    @ReactMethod
    public void downloadFile(String remotePath, String localPath, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }

            String url = remotePath.startsWith("smb://") ? remotePath : "smb://" + remotePath;
            Log.e(TAG, "[downloadFile] remote=" + url + " local=" + localPath);

            SmbFile remoteFile = new SmbFile(url, cifsContext);
            long fileSize = remoteFile.length();
            Log.e(TAG, "[downloadFile] file size=" + fileSize);

            SmbFileInputStream in = new SmbFileInputStream(remoteFile);
            FileOutputStream out = new FileOutputStream(localPath);
            byte[] buffer = new byte[65536];
            int bytesRead;
            long total = 0;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
                total += bytesRead;
            }
            in.close();
            out.close();

            Log.e(TAG, "[downloadFile] SUCCESS " + total + " bytes");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[downloadFile] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("DOWNLOAD_FAILED", e);
        }
    }

    @ReactMethod
    public void uploadFile(String localPath, String remotePath, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }

            String url = remotePath.startsWith("smb://") ? remotePath : "smb://" + remotePath;
            Log.e(TAG, "[uploadFile] local=" + localPath + " remote=" + url);

            java.io.File localFile = new java.io.File(localPath);
            if (!localFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Local file not found: " + localPath);
                return;
            }

            SmbFile remoteFile = new SmbFile(url, cifsContext);
            SmbFileOutputStream out = new SmbFileOutputStream(remoteFile);
            FileInputStream in = new FileInputStream(localFile);
            byte[] buffer = new byte[65536];
            int bytesRead;
            long total = 0;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
                total += bytesRead;
            }
            in.close();
            out.close();

            Log.e(TAG, "[uploadFile] SUCCESS " + total + " bytes");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[uploadFile] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("UPLOAD_FAILED", e);
        }
    }

    @ReactMethod
    public void createDirectory(String path, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }
            String url = path.startsWith("smb://") ? path : "smb://" + path;
            if (!url.endsWith("/")) url += "/";
            Log.e(TAG, "[createDirectory] " + url);
            SmbFile dir = new SmbFile(url, cifsContext);
            if (!dir.exists()) {
                dir.mkdir();
                Log.e(TAG, "[createDirectory] SUCCESS");
                promise.resolve(true);
            } else {
                promise.reject("ALREADY_EXISTS", "Folder already exists");
            }
        } catch (Exception e) {
            Log.e(TAG, "[createDirectory] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("CREATE_DIR_FAILED", e);
        }
    }

    @ReactMethod
    public void createFile(String path, Promise promise) {
        try {
            if (cifsContext == null) {
                promise.reject("NOT_CONNECTED", "Call connect() first");
                return;
            }
            String url = path.startsWith("smb://") ? path : "smb://" + path;
            Log.e(TAG, "[createFile] " + url);
            SmbFile file = new SmbFile(url, cifsContext);
            if (!file.exists()) {
                file.createNewFile();
                Log.e(TAG, "[createFile] SUCCESS");
                promise.resolve(true);
            } else {
                promise.reject("ALREADY_EXISTS", "File already exists");
            }
        } catch (Exception e) {
            Log.e(TAG, "[createFile] ERROR: " + e.getMessage());
            e.printStackTrace();
            promise.reject("CREATE_FILE_FAILED", e);
        }
    }

    @ReactMethod
    public void isExternalStorageManager(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                boolean granted = Environment.isExternalStorageManager();
                promise.resolve(granted);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void openAllFilesAccessSettings(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                ReactApplicationContext context = getReactApplicationContext();
                Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                promise.resolve(true);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "[openAllFilesAccessSettings] ERROR: " + e.getMessage());
            promise.reject("OPEN_SETTINGS_FAILED", e);
        }
    }
}
