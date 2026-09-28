package com.sadhana.tracker;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Thin native shell around the offline Sadhana web app bundled in assets/www.
 * Provides: durable storage in app-private files, saving/sharing exported files,
 * a file picker for restoring backups, and back-button handling.
 */
public class MainActivity extends Activity {

    private static final int REQ_PICK_FILE = 4201;
    private static final int REQ_NOTIF = 4202;
    private static final String DATA_FILE = "sadhana.json";

    private WebView web;
    private FrameLayout root;
    private View navScrim;
    private ValueCallback<Uri[]> pendingFileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        boolean night = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;

        int bg = night ? 0xFF150E09 : 0xFFFBF6EF;
        root = new FrameLayout(this);
        root.setBackgroundColor(bg);
        web = new WebView(this);
        web.setBackgroundColor(bg);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        // Coloured strip behind the system navigation bar, matching the app's bottom nav.
        navScrim = new View(this);
        navScrim.setBackgroundColor(night ? 0xFF2D1A0E : 0xFF6B260A);
        root.addView(navScrim, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM));
        setContentView(root);

        // Keep content clear of the status bar, navigation bar and keyboard (edge-to-edge on Android 15+).
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            FrameLayout.LayoutParams wp = (FrameLayout.LayoutParams) web.getLayoutParams();
            wp.setMargins(l, t, r, b);
            web.setLayoutParams(wp);
            FrameLayout.LayoutParams sp = (FrameLayout.LayoutParams) navScrim.getLayoutParams();
            sp.height = b;
            navScrim.setLayoutParams(sp);
            return insets;
        });

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Choose backup file"), REQ_PICK_FILE);
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_FILE && pendingFileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            pendingFileCallback.onReceiveValue(result);
            pendingFileCallback = null;
        }
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF && web != null) {
            web.evaluateJavascript("window.__sadhanaResume && window.__sadhanaResume()", null);
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.evaluateJavascript("window.__sadhanaFlush && window.__sadhanaFlush()", null);
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.__sadhanaResume && window.__sadhanaResume()", null);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.__sadhanaBack ? window.__sadhanaBack() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
        }
        super.onDestroy();
    }

    /** Paints status/navigation bar areas to match the web app's theme. */
    @SuppressWarnings("deprecation")
    private void applySystemColors(int bg, int nav, boolean lightBg) {
        root.setBackgroundColor(bg);
        web.setBackgroundColor(bg);
        navScrim.setBackgroundColor(nav);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(nav);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(lightBg ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                c.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            View d = getWindow().getDecorView();
            int f = d.getSystemUiVisibility();
            f = lightBg ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            f &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            d.setSystemUiVisibility(f);
        }
    }

    /** Methods callable from JavaScript as window.AndroidBridge.*  (run on a background thread). */
    private class Bridge {

        /** Turns the daily reminder on/off at hour:minute. Asks for notification permission if needed. */
        @JavascriptInterface
        public String setReminder(boolean on, int hour, int minute, boolean onlyIfMissing) {
            Reminders.save(MainActivity.this, on, hour, minute, onlyIfMissing);
            if (on && !Reminders.allowed(MainActivity.this)) {
                runOnUiThread(MainActivity.this::askNotificationPermission);
                return "Please allow notifications for Sadhana";
            }
            return on ? "Reminder set" : "Reminder off";
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return Reminders.allowed(MainActivity.this);
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(() -> {
                Intent i = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
                i.putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
                try { startActivity(i); } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public String testReminder() {
            if (!Reminders.allowed(MainActivity.this)) {
                runOnUiThread(MainActivity.this::askNotificationPermission);
                return "Please allow notifications for Sadhana";
            }
            Reminders.show(MainActivity.this, true);
            return "Test notification sent";
        }

        @JavascriptInterface
        public void setSystemColors(String bgHex, String navHex, boolean lightBg) {
            try {
                final int bg = Color.parseColor(bgHex.trim());
                final int nav = Color.parseColor(navHex.trim());
                runOnUiThread(() -> applySystemColors(bg, nav, lightBg));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public String load() {
            File f = new File(getFilesDir(), DATA_FILE);
            if (!f.exists()) return "";
            try (FileInputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[(int) f.length()];
                int off = 0, n;
                while (off < buf.length && (n = in.read(buf, off, buf.length - off)) > 0) off += n;
                return new String(buf, 0, off, StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public synchronized void save(String json) {
            File dir = getFilesDir();
            File tmp = new File(dir, DATA_FILE + ".tmp");
            File dst = new File(dir, DATA_FILE);
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            } catch (Exception e) {
                return;
            }
            //noinspection ResultOfMethodCallIgnored
            tmp.renameTo(dst);
        }

        /** Saves a base64 file into Downloads/Sadhana and optionally opens the share sheet. */
        @JavascriptInterface
        public String saveFile(String base64, String fileName, String mime, boolean share) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                ContentResolver cr = getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Sadhana");
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return "Could not create file";
                try (OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) return "Could not write file";
                    out.write(bytes);
                }
                if (share) {
                    final Uri shareUri = uri;
                    runOnUiThread(() -> {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(mime);
                        send.putExtra(Intent.EXTRA_STREAM, shareUri);
                        send.putExtra(Intent.EXTRA_SUBJECT, fileName.replace(".pdf", ""));
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(Intent.createChooser(send, "Share sadhana card"));
                        } catch (Exception e) {
                            Toast.makeText(MainActivity.this, "No app to share with", Toast.LENGTH_SHORT).show();
                        }
                    });
                    return "Opening share…";
                }
                return "Saved to Downloads/Sadhana/" + fileName;
            } catch (Exception e) {
                return "Save failed: " + e.getMessage();
            }
        }
    }
}
