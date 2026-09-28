package com.sadhana.tracker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Daily "record your sadhana" reminder: scheduling, and building the notification. */
final class Reminders {

    static final String CHANNEL_ID = "daily_reminder";
    static final String ACTION_FIRE = "com.sadhana.tracker.REMINDER";
    private static final String PREFS = "reminder";
    private static final int NOTIF_ID = 108;

    private Reminders() { }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void save(Context c, boolean on, int hour, int minute, boolean onlyIfMissing) {
        prefs(c).edit().putBoolean("on", on).putInt("h", hour).putInt("m", minute)
                .putBoolean("onlyMissing", onlyIfMissing).apply();
        schedule(c);
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION_FIRE);
        return PendingIntent.getBroadcast(c, 1, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** (Re)schedules the next reminder, or cancels it when reminders are off. */
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c);
        am.cancel(pi);
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("on", false)) return;

        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, p.getInt("h", 21));
        next.set(Calendar.MINUTE, p.getInt("m", 0));
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis() + 30_000) next.add(Calendar.DAY_OF_MONTH, 1);
        // Inexact but Doze-friendly; needs no special "exact alarm" permission.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Daily reminder",
                NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Reminds you to record your sadhana");
        nm.createNotificationChannel(ch);
    }

    static boolean allowed(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    /** Shows the reminder. force=true ignores the "only if not logged" rule (used by the test button). */
    static void show(Context c, boolean force) {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        JSONObject day = readDay(c, today);
        int rounds = 0;
        boolean logged = false;
        if (day != null) {
            logged = true;
            JSONArray r = day.optJSONArray("rounds");
            if (r != null) for (int i = 0; i < r.length(); i++) rounds += r.optInt(i, 0);
        }
        if (!force && logged && prefs(c).getBoolean("onlyMissing", true)) return;

        String title, text;
        if (!logged) {
            title = "Hare Krishna! 📿";
            text = "Take a minute to record today's sadhana — sleep, rounds, reading and hearing.";
        } else {
            title = "Today's sadhana";
            text = rounds + " rounds recorded so far. Tap to complete today's entry.";
        }

        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(c, 2, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(c, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notify)
                .setColor(0xFFA8410D)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(content)
                .setAutoCancel(true)
                .build();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null && nm.areNotificationsEnabled()) nm.notify(NOTIF_ID, n);
    }

    private static JSONObject readDay(Context c, String key) {
        File f = new File(c.getFilesDir(), "sadhana.json");
        if (!f.exists()) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) f.length()];
            int off = 0, n;
            while (off < buf.length && (n = in.read(buf, off, buf.length - off)) > 0) off += n;
            JSONObject days = new JSONObject(new String(buf, 0, off, StandardCharsets.UTF_8)).optJSONObject("days");
            return days == null ? null : days.optJSONObject(key);
        } catch (Exception e) {
            return null;
        }
    }
}
