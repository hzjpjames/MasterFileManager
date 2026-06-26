package com.masterfilemanager.usb;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 静态 USB 广播接收器 — 在 AndroidManifest 中声明
 * 当 USB 存储设备挂载/卸载时，系统发送广播，此接收器启动 App 以刷新存储列表
 */
public class USBReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();

        if (Intent.ACTION_MEDIA_MOUNTED.equals(action) ||
            Intent.ACTION_MEDIA_UNMOUNTED.equals(action) ||
            Intent.ACTION_MEDIA_REMOVED.equals(action)) {

            // 启动 MainActivity 并传递 USB 事件信息
            Intent launchIntent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                launchIntent.putExtra("usb_event", action);
                if (intent.getData() != null) {
                    launchIntent.putExtra("usb_path", intent.getData().getPath());
                }
                context.startActivity(launchIntent);
            }
        }
    }
}
