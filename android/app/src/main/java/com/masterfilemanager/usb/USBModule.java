package com.masterfilemanager.usb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import androidx.annotation.NonNull;
import androidx.documentfile.provider.DocumentFile;
import android.content.ContentResolver;
import android.app.Activity;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import android.util.Log;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class USBModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final String TAG = "USBModule";
    private final ReactApplicationContext reactContext;
    private BroadcastReceiver usbReceiver;

    public USBModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        registerReceiver();
        context.addActivityEventListener(this);
        loadSavedOtgUri(context);
    }

    @Override
    @NonNull
    public String getName() {
        return "USBModule";
    }

    @ReactMethod
    public void addListener(String eventName) { }

    @ReactMethod
    public void removeListeners(Integer count) { }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    private void registerReceiver() {
        usbReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (action == null) return;
                Log.d(TAG, "Broadcast received: " + action);

                WritableMap event = Arguments.createMap();
                if (Intent.ACTION_MEDIA_MOUNTED.equals(action) ||
                    Intent.ACTION_MEDIA_UNMOUNTED.equals(action) ||
                    Intent.ACTION_MEDIA_REMOVED.equals(action) ||
                    Intent.ACTION_MEDIA_BAD_REMOVAL.equals(action)) {
                    String type = action.replace("android.intent.action.MEDIA_", "").toLowerCase();
                    event.putString("type", type);
                    if (intent.getData() != null) {
                        event.putString("path", intent.getData().getPath());
                    }
                    sendEvent("USB_STATE_CHANGED", event);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_MEDIA_MOUNTED);
        filter.addAction(Intent.ACTION_MEDIA_UNMOUNTED);
        filter.addAction(Intent.ACTION_MEDIA_REMOVED);
        filter.addAction(Intent.ACTION_MEDIA_BAD_REMOVAL);
        filter.addDataScheme("file");

        try {
            reactContext.registerReceiver(usbReceiver, filter);
            Log.d(TAG, "BroadcastReceiver registered");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register receiver: " + e.getMessage());
        }
    }

    private File[] listReadableDirs(String dirPath) {
        File dir = new File(dirPath);
        if (!dir.exists() || !dir.isDirectory()) return new File[0];
        File[] files = dir.listFiles();
        if (files == null) return new File[0];
        List<File> result = new ArrayList<>();
        for (File f : files) {
            if (f.isDirectory() && f.canRead()) {
                result.add(f);
            }
        }
        return result.toArray(new File[0]);
    }

    @ReactMethod
    public void scanVolumes(Promise promise) {
        try {
            WritableArray volumes = Arguments.createArray();
            Set<String> addedPaths = new HashSet<>();

            Log.d(TAG, "=== scanVolumes start ===");

            // Phase 1: Scan /storage/
            Log.d(TAG, "Phase 1: scanning /storage/");
            File[] storageDirs = listReadableDirs("/storage");
            for (File dir : storageDirs) {
                String name = dir.getName();
                if (name.equals("emulated") || name.equals("self") || name.startsWith(".")) continue;

                String path = dir.getAbsolutePath();
                Log.d(TAG, "Found /storage/" + name + " path=" + path);

                WritableMap vol = Arguments.createMap();
                vol.putString("path", path);
                vol.putString("uuid", name);
                vol.putBoolean("mounted", true);
                vol.putBoolean("removable", true);

                String displayName;
                if (name.toLowerCase().contains("sd")) {
                    displayName = "SD Card";
                } else if (name.matches("[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}")) {
                    displayName = "USB Device (" + name + ")";
                } else {
                    displayName = "External Storage";
                }
                vol.putString("displayName", displayName);

                try {
                    StatFs stat = new StatFs(path);
                    vol.putDouble("totalSize", (double) stat.getBlockSizeLong() * stat.getBlockCountLong());
                    vol.putDouble("freeSize", (double) stat.getBlockSizeLong() * stat.getAvailableBlocksLong());
                } catch (Exception e) {
                    vol.putDouble("totalSize", 0);
                    vol.putDouble("freeSize", 0);
                }

                volumes.pushMap(vol);
                addedPaths.add(path);
                Log.d(TAG, "Added from /storage/: " + displayName + " path=" + path);
            }

            // Phase 2: Scan /mnt/media_rw/ + /proc/mounts fallback
            Log.d(TAG, "Phase 2: scanning /mnt/media_rw/");
            File[] mntDirs = listReadableDirs("/mnt/media_rw");
            for (File dir : mntDirs) {
                String name = dir.getName();
                String mntPath = dir.getAbsolutePath();
                if (addedPaths.contains(mntPath)) continue;

                // NOTE: Do NOT require children.length > 0 — empty USB drives must be detected too

                Log.d(TAG, "Found /mnt/media_rw/" + name + " path=" + mntPath);

                WritableMap vol = Arguments.createMap();
                vol.putString("path", mntPath);
                vol.putString("uuid", name);
                vol.putBoolean("mounted", true);
                vol.putBoolean("removable", true);

                String displayName;
                if (name.matches("[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}")) {
                    displayName = "USB Device (" + name + ")";
                } else {
                    displayName = "External Storage (" + name + ")";
                }
                vol.putString("displayName", displayName);

                try {
                    StatFs stat = new StatFs(mntPath);
                    vol.putDouble("totalSize", (double) stat.getBlockSizeLong() * stat.getBlockCountLong());
                    vol.putDouble("freeSize", (double) stat.getBlockSizeLong() * stat.getAvailableBlocksLong());
                } catch (Exception e) {
                    vol.putDouble("totalSize", 0);
                    vol.putDouble("freeSize", 0);
                }

                volumes.pushMap(vol);
                addedPaths.add(mntPath);
                Log.d(TAG, "Added from /mnt/media_rw/: " + displayName + " path=" + mntPath);
            }

            // Phase 2b: /proc/mounts fallback for USB/OTG devices
            Log.d(TAG, "Phase 2b: /proc/mounts fallback scan");
            try {
                BufferedReader br = new BufferedReader(new FileReader("/proc/mounts"));
                String line;
                while ((line = br.readLine()) != null) {
                    // Look for vold-mounted removable storage (USB OTG, SD card)
                    if (line.contains("vold/public") || (line.contains("/mnt/media_rw/") && !line.contains("emulated"))) {
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 2) {
                            String mp = parts[1];
                            if (addedPaths.contains(mp)) continue;

                            Log.d(TAG, "Found mount point: " + mp);

                            WritableMap vol = Arguments.createMap();
                            vol.putString("path", mp);
                            String uuid = new File(mp).getName();
                            vol.putString("uuid", uuid);
                            vol.putBoolean("mounted", true);
                            vol.putBoolean("removable", true);

                            String displayName;
                            if (uuid.matches("[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}")) {
                                displayName = "USB Device (" + uuid + ")";
                            } else {
                                displayName = "External Storage (" + uuid + ")";
                            }
                            vol.putString("displayName", displayName);

                            try {
                                StatFs stat = new StatFs(mp);
                                vol.putDouble("totalSize", (double) stat.getBlockSizeLong() * stat.getBlockCountLong());
                                vol.putDouble("freeSize", (double) stat.getBlockSizeLong() * stat.getAvailableBlocksLong());
                            } catch (Exception e) {
                                vol.putDouble("totalSize", 0);
                                vol.putDouble("freeSize", 0);
                            }

                            volumes.pushMap(vol);
                            addedPaths.add(mp);
                            Log.d(TAG, "Added from /proc/mounts: " + displayName + " path=" + mp);
                        }
                    }
                }
                br.close();
            } catch (Exception e) {
                Log.e(TAG, "/proc/mounts fallback error: " + e.getMessage());
            }

            // Phase 3: Cross-reference with StorageManager
            Log.d(TAG, "Phase 3: StorageManager cross-reference");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                StorageManager sm = (StorageManager) reactContext.getSystemService(Context.STORAGE_SERVICE);
                if (sm != null) {
                    List<StorageVolume> svList = sm.getStorageVolumes();
                    Log.d(TAG, "StorageManager has " + svList.size() + " volumes");

                    for (StorageVolume sv : svList) {
                        String uuid = sv.getUuid();
                        String state = sv.getState();
                        boolean isEmulated = sv.isEmulated();
                        boolean isRemovable = sv.isRemovable();
                        Log.d(TAG, "  SV: uuid=" + uuid + " state=" + state + " emulated=" + isEmulated);

                        if (isEmulated) continue;

                        boolean alreadyAdded = false;
                        for (int i = 0; i < volumes.size(); i++) {
                            String existingUuid = volumes.getMap(i).getString("uuid");
                            if (uuid != null && uuid.equals(existingUuid)) {
                                alreadyAdded = true;
                                Log.d(TAG, "  Volume already added: " + uuid + " mounted=" + state);
                                break;
                            }
                        }

                        if (alreadyAdded) continue;

                        String path = resolveVolumePath(sv);
                        Log.d(TAG, "  Unlisted volume " + uuid + " resolved path: " + path);

                        if (path != null && !path.isEmpty()) {
                            // Trust StorageManager path — /mnt/media_rw/ may not be directly readable
                            // but the specific volume subdirectory is accessible via file API
                            File testDir = new File(path);
                            if (testDir.exists()) {
                                WritableMap vol = Arguments.createMap();
                                vol.putString("path", path);
                                vol.putString("uuid", uuid != null ? uuid : "");
                                vol.putBoolean("mounted", Environment.MEDIA_MOUNTED.equals(state));
                                vol.putBoolean("removable", isRemovable);

                                String desc = sv.getDescription(reactContext);
                                vol.putString("displayName", (desc != null && !desc.isEmpty()) ? desc : "USB Device");

                                try {
                                    StatFs stat = new StatFs(path);
                                    vol.putDouble("totalSize", (double) stat.getBlockSizeLong() * stat.getBlockCountLong());
                                    vol.putDouble("freeSize", (double) stat.getBlockSizeLong() * stat.getAvailableBlocksLong());
                                } catch (Exception e) {
                                    vol.putDouble("totalSize", 0);
                                    vol.putDouble("freeSize", 0);
                                }

                                volumes.pushMap(vol);
                                addedPaths.add(path);
                                Log.d(TAG, "  Added StorageManager volume: " + desc + " path=" + path);
                            }
                        }
                    }
                }
            }

            Log.d(TAG, "scanVolumes done: " + volumes.size() + " volumes");
            promise.resolve(volumes);
        } catch (Exception e) {
            Log.e(TAG, "scanVolumes error: " + e.getMessage(), e);
            promise.reject("SCAN_ERROR", e.getMessage());
        }
    }

    private String resolveVolumePath(StorageVolume sv) {
        String uuid = sv.getUuid();
        Log.d(TAG, "resolveVolumePath: uuid=" + uuid);

        // Method 1: getDirectory() (Android Q+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                File dir = sv.getDirectory();
                if (dir != null) {
                    Log.d(TAG, "  getDirectory()=" + dir.getAbsolutePath());
                    return dir.getAbsolutePath();
                }
            } catch (Exception e) {
                Log.d(TAG, "  getDirectory() failed: " + e.getMessage());
            }
        }

        // Method 2: Reflection getPath()
        try {
            Method m = StorageVolume.class.getMethod("getPath");
            Object result = m.invoke(sv);
            if (result instanceof File) {
                Log.d(TAG, "  getPath()=" + ((File) result).getAbsolutePath());
                return ((File) result).getAbsolutePath();
            }
            if (result instanceof String) {
                Log.d(TAG, "  getPath()=" + result);
                return (String) result;
            }
        } catch (Exception e) {
            Log.d(TAG, "  getPath() reflection failed: " + e.getMessage());
        }

        // Method 3: Reflection mPath field
        try {
            Field f = StorageVolume.class.getDeclaredField("mPath");
            f.setAccessible(true);
            Object p = f.get(sv);
            if (p instanceof File) {
                Log.d(TAG, "  mPath=" + ((File) p).getAbsolutePath());
                return ((File) p).getAbsolutePath();
            }
            if (p instanceof String) {
                Log.d(TAG, "  mPath=" + p);
                return (String) p;
            }
        } catch (Exception e) {
            Log.d(TAG, "  mPath reflection failed: " + e.getMessage());
        }

        // Method 4: /proc/mounts lookup
        if (uuid != null) {
            String mp = findMountPath(uuid);
            if (mp != null) {
                Log.d(TAG, "  /proc/mounts: " + mp);
                return mp;
            }
        }

        // Method 5: Fallback /storage/UUID
        if (uuid != null) {
            String fb = "/storage/" + uuid;
            File f = new File(fb);
            if (f.exists() && f.canRead()) {
                Log.d(TAG, "  fallback /storage/ works: " + fb);
                return fb;
            }
        }

        Log.d(TAG, "  All methods failed for uuid=" + uuid);
        return null;
    }

    private String findMountPath(String uuid) {
        if (uuid == null) return null;
        try {
            BufferedReader br = new BufferedReader(new FileReader("/proc/mounts"));
            String line;
            while ((line = br.readLine()) != null) {
                if (line.contains(uuid)) {
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 2) {
                        String mp = parts[1];
                        File f = new File(mp);
                        if (f.exists()) {
                            br.close();
                            return mp;
                        }
                    }
                }
            }
            br.close();
        } catch (Exception ignored) {}
        return null;
    }

    @ReactMethod
    public void debugStorageInfo(Promise promise) {
        try {
            StringBuilder sb = new StringBuilder();
            
            // Also run scanVolumes and show results
            sb.append("=== scanVolumes() Test ===\n");
            try {
                WritableArray volumes = Arguments.createArray();
                Set<String> addedPaths = new HashSet<>();
                
                // Phase 1
                sb.append("\n--- Phase 1: /storage/ ---\n");
                File[] storageDirs = listReadableDirs("/storage");
                sb.append("  Found ").append(storageDirs.length).append(" readable dirs\n");
                for (File dir : storageDirs) {
                    String name = dir.getName();
                    if (name.equals("emulated") || name.equals("self") || name.startsWith(".")) continue;
                    sb.append("  ADD: ").append(name).append(" path=").append(dir.getAbsolutePath()).append("\n");
                    WritableMap vol = Arguments.createMap();
                    vol.putString("path", dir.getAbsolutePath());
                    vol.putString("uuid", name);
                    vol.putBoolean("mounted", true);
                    vol.putBoolean("removable", true);
                    vol.putString("displayName", "External (" + name + ")");
                    volumes.pushMap(vol);
                    addedPaths.add(dir.getAbsolutePath());
                }
                
                // Phase 2
                sb.append("\n--- Phase 2: /mnt/media_rw/ ---\n");
                File[] mntDirs = listReadableDirs("/mnt/media_rw");
                sb.append("  Found ").append(mntDirs.length).append(" readable dirs\n");
                for (File dir : mntDirs) {
                    String name = dir.getName();
                    String mntPath = dir.getAbsolutePath();
                    if (addedPaths.contains(mntPath)) continue;
                    sb.append("  ADD: ").append(name).append(" path=").append(mntPath).append("\n");
                    WritableMap vol = Arguments.createMap();
                    vol.putString("path", mntPath);
                    vol.putString("uuid", name);
                    vol.putBoolean("mounted", true);
                    vol.putBoolean("removable", true);
                    vol.putString("displayName", "USB (" + name + ")");
                    volumes.pushMap(vol);
                    addedPaths.add(mntPath);
                }
                
                // Phase 2b
                sb.append("\n--- Phase 2b: /proc/mounts ---\n");
                try {
                    BufferedReader br = new BufferedReader(new FileReader("/proc/mounts"));
                    String line;
                    while ((line = br.readLine()) != null) {
                        if (line.contains("vold/public") || (line.contains("/mnt/media_rw/") && !line.contains("emulated"))) {
                            String[] parts = line.split(" ");
                            if (parts.length >= 2) {
                                String mp = parts[1];
                                if (addedPaths.contains(mp)) continue;
                                sb.append("  ADD from mounts: ").append(mp).append("\n");
                                WritableMap vol = Arguments.createMap();
                                vol.putString("path", mp);
                                vol.putString("uuid", new File(mp).getName());
                                vol.putBoolean("mounted", true);
                                vol.putBoolean("removable", true);
                                vol.putString("displayName", "USB-Mounts (" + new File(mp).getName() + ")");
                                volumes.pushMap(vol);
                                addedPaths.add(mp);
                            }
                        }
                    }
                    br.close();
                } catch (Exception e) {
                    sb.append("  Error: ").append(e.getMessage()).append("\n");
                }
                
                // Phase 3
                sb.append("\n--- Phase 3: StorageManager ---\n");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    StorageManager sm = (StorageManager) reactContext.getSystemService(Context.STORAGE_SERVICE);
                    if (sm != null) {
                        List<StorageVolume> svList = sm.getStorageVolumes();
                        sb.append("  StorageManager volumes: ").append(svList.size()).append("\n");
                        for (StorageVolume sv : svList) {
                            String uuid = sv.getUuid();
                            String state = sv.getState();
                            boolean isEmulated = sv.isEmulated();
                            sb.append("  SV: uuid=").append(uuid).append(" state=").append(state).append(" emu=").append(isEmulated).append("\n");
                            if (isEmulated) { sb.append("    -> skip (emulated)\n"); continue; }
                            String path = resolveVolumePath(sv);
                            sb.append("    resolvePath=").append(path).append("\n");
                            if (path != null && !path.isEmpty() && !addedPaths.contains(path)) {
                                File testDir = new File(path);
                                sb.append("    exists=").append(testDir.exists()).append("\n");
                                if (testDir.exists()) {
                                    sb.append("    -> ADD: ").append(path).append("\n");
                                    WritableMap vol = Arguments.createMap();
                                    vol.putString("path", path);
                                    vol.putString("uuid", uuid != null ? uuid : "");
                                    vol.putBoolean("mounted", true);
                                    vol.putBoolean("removable", sv.isRemovable());
                                    vol.putString("displayName", sv.getDescription(reactContext));
                                    volumes.pushMap(vol);
                                    addedPaths.add(path);
                                }
                            }
                        }
                    }
                }
                
                sb.append("\n=== scanVolumes() Result ===\n");
                sb.append("Total volumes: ").append(volumes.size()).append("\n");
                for (int i = 0; i < volumes.size(); i++) {
                    ReadableMap vol = (ReadableMap) volumes.getMap(i);
                    sb.append("  [").append(i).append("] ");
                    sb.append("path=").append(vol.getString("path")).append(" ");
                    sb.append("name=").append(vol.getString("displayName")).append("\n");
                }
                
            } catch (Exception e) {
                sb.append("\n!!! scanVolumes test error: ").append(e.getMessage()).append("\n");
                for (StackTraceElement ste : e.getStackTrace()) {
                    sb.append("    ").append(ste.toString()).append("\n");
                }
            }
            
            sb.append("\n=== /storage/ ===\n");

            sb.append("=== /storage/ ===\n");
            File storageDir = new File("/storage");
            if (storageDir.exists()) {
                File[] files = storageDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        sb.append("  ").append(f.getName()).append(" dir=").append(f.isDirectory());
                        sb.append(" read=").append(f.canRead());
                        try { sb.append(" free=").append(f.getFreeSpace() / (1024 * 1024)).append("MB"); } catch (Exception ignored) {}
                        sb.append("\n");
                    }
                }
            }

            sb.append("\n=== /mnt/media_rw/ ===\n");
            File mntDir = new File("/mnt/media_rw");
            if (mntDir.exists()) {
                File[] mntFiles = mntDir.listFiles();
                if (mntFiles != null) {
                    for (File f : mntFiles) {
                        sb.append("  ").append(f.getName()).append(" dir=").append(f.isDirectory());
                        sb.append(" read=").append(f.canRead());
                        File[] children = f.listFiles();
                        sb.append(" files=").append(children != null ? children.length : "null");
                        sb.append("\n");
                    }
                }
            }

            sb.append("\n=== /proc/mounts (filtered) ===\n");
            try {
                BufferedReader br = new BufferedReader(new FileReader("/proc/mounts"));
                String line;
                while ((line = br.readLine()) != null) {
                    String[] parts = line.split(" ");
                    if (parts.length < 2) continue;
                    String mp = parts[1];
                    if (mp.startsWith("/storage/") || mp.startsWith("/mnt/") || parts[0].contains("vold")) {
                        sb.append("  ").append(line.trim()).append("\n");
                    }
                }
                br.close();
            } catch (Exception e) { sb.append("  err: ").append(e.getMessage()).append("\n"); }

            sb.append("\n=== StorageManager ===\n");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                StorageManager sm = (StorageManager) reactContext.getSystemService(Context.STORAGE_SERVICE);
                List<StorageVolume> svList = sm.getStorageVolumes();
                sb.append("volumes: ").append(svList.size()).append("\n");
                for (StorageVolume sv : svList) {
                    sb.append("  uuid=").append(sv.getUuid()).append(" state=").append(sv.getState());
                    sb.append(" emu=").append(sv.isEmulated()).append(" rem=").append(sv.isRemovable());
                    sb.append(" desc=").append(sv.getDescription(reactContext));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        File dir = sv.getDirectory();
                        sb.append(" dir=").append(dir != null ? dir.getAbsolutePath() : "null");
                    }
                    sb.append("\n");
                }
            }

            promise.resolve(sb.toString());
        } catch (Exception e) {
            promise.reject("DEBUG_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getVolumeInfo(String path, Promise promise) {
        try {
            StatFs stat = new StatFs(path);
            long blockSize = stat.getBlockSizeLong();
            long totalBlocks = stat.getBlockCountLong();
            long freeBlocks = stat.getAvailableBlocksLong();

            WritableMap info = Arguments.createMap();
            info.putDouble("totalSize", (double) totalBlocks * blockSize);
            info.putDouble("freeSize", (double) freeBlocks * blockSize);
            info.putDouble("usedSize", (double) (totalBlocks - freeBlocks) * blockSize);
            promise.resolve(info);
        } catch (Exception e) {
            promise.reject("STAT_ERROR", e.getMessage());
        }
    }

    // ====== SAF-based OTG Access ======
    private static final int REQUEST_CODE_OTG = 1001;
    // Removed: private Promise mOtgPromise = null;  — using event-driven approach instead
    private static Uri sOtgGrantedUri = null;
    private static final String PREFS_NAME = "MasterFileManager";
    private static final String KEY_OTG_URI = "otg_uri";
    private Promise mOtgPromise = null;

    /**
     * Launch system file picker to let user grant access to USB/OTG device.
     */
    @ReactMethod
    public void showToast(String message, Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                android.widget.Toast.makeText(activity, message, android.widget.Toast.LENGTH_LONG).show();
                promise.resolve(true);
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Launch system file picker to let user grant access to USB/OTG device.
     * Promise-based: resolves with URI string when user grants access.
     * Uses StorageVolume-specific intent when available (auto-navigates to USB),
     * falls back to generic ACTION_OPEN_DOCUMENT_TREE.
     */
    @ReactMethod
    public void requestOTGAccess(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity");
                return;
            }

            // Store promise for onActivityResult
            mOtgPromise = promise;

            Intent intent = null;

            // Try StorageVolume-specific intent first (auto-navigates to USB root)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                StorageManager sm = (StorageManager) reactContext.getSystemService(Context.STORAGE_SERVICE);
                if (sm != null) {
                    for (StorageVolume sv : sm.getStorageVolumes()) {
                        if (!sv.isEmulated() && sv.isRemovable()) {
                            intent = sv.createOpenDocumentTreeIntent();
                            break;
                        }
                    }
                }
            }

            // Fallback to generic ACTION_OPEN_DOCUMENT_TREE
            if (intent == null) {
                intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            }

            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION 
                         | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                         | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            activity.startActivityForResult(intent, REQUEST_CODE_OTG);

        } catch (Exception e) {
            Log.e(TAG, "requestOTGAccess error: " + e.getMessage(), e);
            promise.reject("OTG_ACCESS_ERROR", e.getMessage());
        }
    }

    /**
     * List directory contents using DocumentFile API (SAF).
     */
    @ReactMethod
    public void listOTGDirectory(String uriString, String relativePath, Promise promise) {
        try {
            Uri treeUri;
            if (uriString != null && !uriString.isEmpty()) {
                treeUri = Uri.parse(uriString);
            } else if (sOtgGrantedUri != null) {
                treeUri = sOtgGrantedUri;
            } else {
                promise.reject("NO_OTG_URI", "No OTG URI granted. Call requestOTGAccess() first.");
                return;
            }

            DocumentFile directory = DocumentFile.fromTreeUri(reactContext, treeUri);
            if (directory == null || !directory.exists() || !directory.isDirectory()) {
                promise.reject("OTG_LIST_ERROR", "Invalid tree URI or not a directory");
                return;
            }

            // Navigate to subdirectory if relativePath is provided
            if (relativePath != null && !relativePath.isEmpty() && !relativePath.equals("/")) {
                String[] parts = relativePath.split("/");
                for (String part : parts) {
                    if (part.isEmpty()) continue;
                    DocumentFile next = directory.findFile(part);
                    if (next == null || !next.isDirectory()) {
                        promise.reject("OTG_LIST_ERROR", "Subdirectory not found: " + relativePath);
                        return;
                    }
                    directory = next;
                }
            }

            WritableArray items = Arguments.createArray();
            DocumentFile[] children = directory.listFiles();
            if (children != null) {
                for (DocumentFile child : children) {
                    WritableMap item = Arguments.createMap();
                    item.putString("name", child.getName());
                    item.putString("path", "/otg/" + (relativePath != null ? relativePath + "/" : "") + child.getName());
                    item.putBoolean("isDirectory", child.isDirectory());
                    item.putDouble("size", child.length());
                    item.putDouble("modifiedTime", child.lastModified());
                    item.putString("type", child.isDirectory() ? "directory" : getFileTypeFromName(child.getName()));
                    String ext = "";
                    if (!child.isDirectory() && child.getName() != null) {
                        int dotIdx = child.getName().lastIndexOf('.');
                        if (dotIdx >= 0) ext = child.getName().substring(dotIdx + 1);
                    }
                    item.putString("extension", ext);
                    items.pushMap(item);
                }
            }
            promise.resolve(items);
        } catch (Exception e) {
            Log.e(TAG, "listOTGDirectory error: " + e.getMessage(), e);
            promise.reject("OTG_LIST_ERROR", e.getMessage());
        }
    }

    /**
     * Store the granted SAF URI for persistent access.
     */
    @ReactMethod
    public void setOTGUri(String uriString, Promise promise) {
        try {
            if (uriString != null && !uriString.isEmpty()) {
                sOtgGrantedUri = Uri.parse(uriString);
                // Take persistable permission
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    ContentResolver resolver = reactContext.getContentResolver();
                    resolver.takePersistableUriPermission(sOtgGrantedUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                }
                saveOtgUri(reactContext, uriString);
                promise.resolve(true);
            } else {
                sOtgGrantedUri = null;
                saveOtgUri(reactContext, "");
                promise.resolve(false);
            }
        } catch (Exception e) {
            Log.e(TAG, "setOTGUri error: " + e.getMessage(), e);
            promise.reject("SET_URI_ERROR", e.getMessage());
        }
    }

    /**
     * Get the currently stored OTG URI (if any).
     * Validates the URI before returning - if invalid, clears it.
     */
    @ReactMethod
    public void getOTGUri(Promise promise) {
        // Check static variable first
        if (sOtgGrantedUri != null) {
            if (isUriValid(sOtgGrantedUri)) {
                Log.d(TAG, "getOTGUri: returning valid static URI");
                promise.resolve(sOtgGrantedUri.toString());
            } else {
                // URI is invalid, clear it
                Log.w(TAG, "getOTGUri: static URI is invalid, clearing");
                sOtgGrantedUri = null;
                saveOtgUri(reactContext, "");
                promise.resolve("");
            }
            return;
        }
        
        // Try loading from SharedPreferences
        String saved = loadSavedOtgUri(reactContext);
        if (saved != null && !saved.isEmpty()) {
            Uri parsed = Uri.parse(saved);
            if (isUriValid(parsed)) {
                sOtgGrantedUri = parsed;
                Log.d(TAG, "getOTGUri: returning valid saved URI");
                promise.resolve(saved);
            } else {
                // Saved URI is invalid, clear it
                Log.w(TAG, "getOTGUri: saved URI is invalid, clearing");
                saveOtgUri(reactContext, "");
                promise.resolve("");
            }
            return;
        }
        
        // No URI available
        Log.d(TAG, "getOTGUri: no valid URI available");
        promise.resolve("");
    }

    private void saveOtgUri(Context context, String uriString) {
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_OTG_URI, uriString);
            editor.apply();
            Log.d(TAG, "Saved OTG URI: " + uriString);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save OTG URI: " + e.getMessage());
        }
    }

    private String loadSavedOtgUri(Context context) {
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_OTG_URI, "");
        } catch (Exception e) {
            Log.e(TAG, "Failed to load OTG URI: " + e.getMessage());
            return "";
        }
    }

    /**
     * Check if the OTG URI is still valid.
     */
    private boolean isUriValid(Uri uri) {
        if (uri == null) return false;
        try {
            DocumentFile root = DocumentFile.fromTreeUri(reactContext, uri);
            if (root == null) {
                Log.w(TAG, "isUriValid: root is null for URI: " + uri);
                return false;
            }
            // Lightweight check: exists() + canRead() instead of listFiles()
            // listFiles() can fail on large directories or permission edge cases
            // even when the URI is actually valid
            boolean valid = root.exists() && root.canRead();
            Log.d(TAG, "isUriValid: URI valid=" + valid + ", uri=" + uri
                    + ", exists=" + root.exists() + ", canRead=" + root.canRead());
            return valid;
        } catch (Exception e) {
            Log.w(TAG, "isUriValid: exception: " + e.getMessage());
            return false;
        }
    }

    /**
     * Check if the OTG URI is still valid (JS-accessible).
     */
    @ReactMethod
    public void checkUriValidity(String uriString, Promise promise) {
        try {
            if (uriString == null || uriString.isEmpty()) {
                promise.resolve(false);
                return;
            }
            Uri uri = Uri.parse(uriString);
            boolean valid = isUriValid(uri);
            Log.d(TAG, "checkUriValidity(JS): uri=" + uriString + ", valid=" + valid);
            promise.resolve(valid);
        } catch (Exception e) {
            Log.e(TAG, "checkUriValidity(JS) error: " + e.getMessage());
            promise.resolve(false);
        }
    }

    // ActivityEventListener implementation
    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        Log.d("USBModule", "onActivityResult: requestCode=" + requestCode + " resultCode=" + resultCode + " data=" + (data != null ? data.getData() : null));
        if (requestCode == REQUEST_CODE_OTG) {
            if (mOtgPromise == null) {
                Log.w(TAG, "onActivityResult: mOtgPromise is null");
                return;
            }

            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    // Take persistable permission
                    try {
                        ContentResolver resolver = reactContext.getContentResolver();
                        resolver.takePersistableUriPermission(uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to take persistable permission: " + e.getMessage());
                    }

                    sOtgGrantedUri = uri;
                    saveOtgUri(reactContext, uri.toString());

                    Log.d(TAG, "OTG access granted: " + uri.toString());
                    mOtgPromise.resolve(uri.toString());
                } else {
                    mOtgPromise.resolve("");
                }
            } else {
                // User cancelled or error
                sOtgGrantedUri = null;
                Log.d(TAG, "OTG access cancelled or failed");
                mOtgPromise.resolve("");
            }
            mOtgPromise = null;
        }
    }

    @Override
    public void onNewIntent(Intent intent) {}

    private String getFileTypeFromName(String name) {
        if (name == null || name.isEmpty()) return "unknown";
        int dotIdx = name.lastIndexOf('.');
        if (dotIdx < 0) return "file";
        String ext = name.substring(dotIdx + 1).toLowerCase();
        switch (ext) {
            case "jpg": case "jpeg": case "png": case "gif": case "webp": case "bmp": case "svg": return "image";
            case "mp4": case "avi": case "mkv": case "mov": case "wmv": case "flv": case "3gp": return "video";
            case "mp3": case "wav": case "flac": case "aac": case "ogg": case "m4a": case "wma": return "audio";
            case "pdf": return "pdf";
            case "doc": case "docx": return "word";
            case "xls": case "xlsx": return "excel";
            case "ppt": case "pptx": return "powerpoint";
            case "txt": case "md": case "log": case "csv": case "json": case "xml": case "html": case "css": case "js": case "ts": case "java": case "py": case "sh": case "bat": case "ps1": return "text";
            case "zip": case "rar": case "7z": case "tar": case "gz": return "archive";
            case "apk": return "apk";
            default: return "file";
        }
    }

    /**
     * Create a directory on OTG via DocumentFile API.
     */
    @ReactMethod
    public void createOTGFolder(String uriString, String relativePath, String folderName, Promise promise) {
        try {
            Log.d(TAG, "createOTGFolder: uri=" + uriString + " relativePath=" + relativePath + " folderName=" + folderName);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "createOTGFolder: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "createOTGFolder: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile created = directory.createDirectory(folderName);
            if (created != null) {
                promise.resolve(true);
            } else {
                promise.reject("OTG_ERROR", "Failed to create folder: " + folderName);
            }
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Create a file on OTG via DocumentFile API.
     */
    @ReactMethod
    public void createOTGFile(String uriString, String relativePath, String fileName, String mimeType, Promise promise) {
        try {
            Log.d(TAG, "createOTGFile: uri=" + uriString + " relativePath=" + relativePath + " fileName=" + fileName + " mimeType=" + mimeType);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "createOTGFile: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "createOTGFile: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile created = directory.createFile(mimeType != null ? mimeType : "application/octet-stream", fileName);
            if (created != null) {
                promise.resolve(true);
            } else {
                promise.reject("OTG_ERROR", "Failed to create file: " + fileName);
            }
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Delete a file/directory on OTG via DocumentFile API.
     */
    @ReactMethod
    public void deleteOTGItem(String uriString, String relativePath, String itemName, Promise promise) {
        try {
            Log.d(TAG, "deleteOTGItem: uri=" + uriString + " relativePath=" + relativePath + " itemName=" + itemName);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "deleteOTGItem: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "deleteOTGItem: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile target = directory.findFile(itemName);
            if (target == null) {
                promise.reject("OTG_ERROR", "Item not found: " + itemName);
                return;
            }
            boolean deleted = target.delete();
            promise.resolve(deleted);
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Rename a file/directory on OTG via DocumentFile API.
     */
    @ReactMethod
    public void renameOTGItem(String uriString, String relativePath, String oldName, String newName, Promise promise) {
        try {
            Log.d(TAG, "renameOTGItem: uri=" + uriString + " relativePath=" + relativePath + " oldName=" + oldName + " newName=" + newName);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "renameOTGItem: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "renameOTGItem: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile target = directory.findFile(oldName);
            if (target == null) {
                promise.reject("OTG_ERROR", "Item not found: " + oldName);
                return;
            }
            boolean renamed = target.renameTo(newName);
            promise.resolve(renamed);
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Check if a file/directory exists on OTG.
     */
    @ReactMethod
    public void existsOTGItem(String uriString, String relativePath, String itemName, Promise promise) {
        try {
            Log.d(TAG, "existsOTGItem: uri=" + uriString + " relativePath=" + relativePath + " itemName=" + itemName);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "existsOTGItem: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "existsOTGItem: directory=" + directory);
            if (directory == null) {
                promise.resolve(false);
                return;
            }
            DocumentFile target = directory.findFile(itemName);
            promise.resolve(target != null && target.exists());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Copy a file from OTG to local storage.
     */
    @ReactMethod
    public void copyOTGToLocal(String uriString, String relativePath, String fileName, String destLocalPath, Promise promise) {
        try {
            Log.d(TAG, "copyOTGToLocal: uri=" + uriString + " relativePath=" + relativePath + " fileName=" + fileName + " destLocalPath=" + destLocalPath);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "copyOTGToLocal: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "copyOTGToLocal: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile source = directory.findFile(fileName);
            if (source == null) {
                promise.reject("OTG_ERROR", "Source file not found: " + fileName);
                return;
            }
            // Copy via ContentResolver input stream → file output stream
            try (java.io.InputStream is = reactContext.getContentResolver().openInputStream(source.getUri());
                 java.io.FileOutputStream fos = new java.io.FileOutputStream(destLocalPath)) {
                byte[] buffer = new byte[8192];
                int len;
                while ((len = is.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Copy a local file to OTG.
     */
    @ReactMethod
    public void copyLocalToOTG(String uriString, String relativePath, String localPath, String destFileName, String mimeType, Promise promise) {
        try {
            Log.d(TAG, "copyLocalToOTG: uri=" + uriString + " relativePath=" + relativePath + " localPath=" + localPath + " destFileName=" + destFileName + " mimeType=" + mimeType);
            Uri treeUri = resolveOtgUri(uriString);
            Log.d(TAG, "copyLocalToOTG: resolved URI=" + treeUri);
            DocumentFile directory = navigateToOTGDirectory(treeUri, relativePath);
            Log.d(TAG, "copyLocalToOTG: directory=" + directory);
            if (directory == null) {
                promise.reject("OTG_ERROR", "Directory not found: " + relativePath);
                return;
            }
            DocumentFile dest = directory.createFile(mimeType != null ? mimeType : "application/octet-stream", destFileName);
            if (dest == null) {
                promise.reject("OTG_ERROR", "Failed to create file on OTG");
                return;
            }
            try (java.io.FileInputStream fis = new java.io.FileInputStream(localPath);
                 java.io.OutputStream os = reactContext.getContentResolver().openOutputStream(dest.getUri())) {
                byte[] buffer = new byte[8192];
                int len;
                while ((len = fis.read(buffer)) > 0) {
                    os.write(buffer, 0, len);
                }
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OTG_ERROR", e.getMessage());
        }
    }

    /**
     * Helper: resolve OTG URI from string or fallback to stored URI.
     */
    private Uri resolveOtgUri(String uriString) throws Exception {
        Uri uri = null;
        
        // If uriString is provided, validate it
        if (uriString != null && !uriString.isEmpty()) {
            uri = Uri.parse(uriString);
            if (isUriValid(uri)) {
                Log.d(TAG, "resolveOtgUri: using valid provided URI");
                return uri;
            } else {
                Log.w(TAG, "resolveOtgUri: provided URI is invalid, ignoring");
                // Fall through to check static/saved URI
            }
        }
        
        // Check static variable
        if (sOtgGrantedUri != null) {
            if (isUriValid(sOtgGrantedUri)) {
                Log.d(TAG, "resolveOtgUri: using valid static URI");
                return sOtgGrantedUri;
            } else {
                Log.w(TAG, "resolveOtgUri: static URI is invalid, clearing");
                sOtgGrantedUri = null;
                saveOtgUri(reactContext, "");
                // Fall through
            }
        }
        
        // Check saved URI
        String saved = loadSavedOtgUri(reactContext);
        if (saved != null && !saved.isEmpty()) {
            uri = Uri.parse(saved);
            if (isUriValid(uri)) {
                sOtgGrantedUri = uri;
                Log.d(TAG, "resolveOtgUri: using valid saved URI");
                return uri;
            } else {
                Log.w(TAG, "resolveOtgUri: saved URI is invalid, clearing");
                saveOtgUri(reactContext, "");
                // Fall through
            }
        }
        
        // No valid URI available
        Log.e(TAG, "resolveOtgUri: No valid OTG URI available");
        throw new Exception("No valid OTG URI available. Call requestOTGAccess() first.");
    }

    /**
     * Helper: navigate to a subdirectory in OTG via relative path.
     */
    private DocumentFile navigateToOTGDirectory(Uri treeUri, String relativePath) {
        try {
            DocumentFile directory = DocumentFile.fromTreeUri(reactContext, treeUri);
            if (directory == null || !directory.exists()) return null;
            if (relativePath == null || relativePath.isEmpty() || relativePath.equals("/")) return directory;
            String[] parts = relativePath.split("/");
            for (String part : parts) {
                if (part.isEmpty()) continue;
                DocumentFile next = directory.findFile(part);
                if (next == null || !next.isDirectory()) return null;
                directory = next;
            }
            return directory;
        } catch (Exception e) {
            Log.e(TAG, "navigateToOTGDirectory error: " + e.getMessage());
            return null;
        }
    }
}
