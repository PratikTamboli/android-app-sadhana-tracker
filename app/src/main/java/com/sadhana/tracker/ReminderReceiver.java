package com.sadhana.tracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires the daily reminder, and re-arms it after reboot, app update or clock changes. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Reminders.ACTION_FIRE.equals(action)) {
            Reminders.show(context, false);
        }
        Reminders.schedule(context); // always arm the next day's reminder
    }
}
