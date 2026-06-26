package com.masterfilemanager.smb;

import android.util.Log;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SMBPackage implements ReactPackage {
    private static final String TAG = "SMBPackage";
    static { Log.e(TAG, "SMBPackage class loaded! CL=" + SMBPackage.class.getClassLoader()); }
    { Log.e(TAG, "SMBPackage instance created"); }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        Log.e(TAG, "SMBPackage.createNativeModules called");
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new SMBModule(reactContext));
        return modules;
    }

    // Deprecated in RN 0.73+, but kept for compatibility
    @Override
    public List<com.facebook.react.uimanager.ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
