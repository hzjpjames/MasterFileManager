package com.masterfilemanager.utils;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import java.io.File;

public class FileOpenerModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    public FileOpenerModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "FileOpener";
    }

    @ReactMethod
    public void openFile(String filePath, String mimeType, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + filePath);
                return;
            }
            Uri uri = FileProvider.getUriForFile(reactContext,
                reactContext.getPackageName() + ".fileprovider", file);
            if (mimeType == null || mimeType.isEmpty()) {
                String ext = MimeTypeMap.getFileExtensionFromUrl(filePath);
                if (ext != null) {
                    mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
                }
                if (mimeType == null || mimeType.isEmpty()) {
                    mimeType = "application/octet-stream";
                }
            }
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            addIntentFlags(intent);
            startActivitySafe(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_FILE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void shareFile(String filePath, String mimeType, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + filePath);
                return;
            }
            Uri uri = FileProvider.getUriForFile(reactContext,
                reactContext.getPackageName() + ".fileprovider", file);
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = "application/octet-stream";
            }
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            addIntentFlags(intent);
            startActivitySafe(Intent.createChooser(intent, "\u5206\u4eab\u6587\u4ef6"));
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SHARE_FILE_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void openFileWithChooser(String filePath, String mimeType, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + filePath);
                return;
            }
            Uri uri = FileProvider.getUriForFile(reactContext,
                reactContext.getPackageName() + ".fileprovider", file);
            if (mimeType == null || mimeType.isEmpty()) {
                String ext = MimeTypeMap.getFileExtensionFromUrl(filePath);
                if (ext != null) {
                    mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
                }
                if (mimeType == null || mimeType.isEmpty()) {
                    mimeType = "application/octet-stream";
                }
            }
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            addIntentFlags(intent);
            startActivitySafe(Intent.createChooser(intent, "\u9009\u62e9\u6253\u5f00\u65b9\u5f0f"));
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_FILE_ERROR", e.getMessage(), e);
        }
    }

    private void addIntentFlags(Intent intent) {
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
    }

    private void startActivitySafe(Intent intent) {
        Activity activity = reactContext.getCurrentActivity();
        if (activity != null && !activity.isFinishing() && !activity.isDestroyed()) {
            activity.startActivity(intent);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
        }
    }
}
