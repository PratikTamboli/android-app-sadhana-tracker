# Sadhana Tracker (Android)

Daily sadhana log with a weekly **Sadhana Card** PDF export. Works fully offline; data stays on the phone.

## Features
- **Home**: week date strip (✓ dots: green = target met, orange = partial), tap month to jump to any date
- **Sleep**: slept-at / woke-up time pickers, hours of rest, "Copy last entry"
- **Chanting**: 4 time slots (Before 6:30 AM / 8 AM / 10 AM / Later), +/− or tap number to type, progress to daily target, extra rounds
- **Association (hearing)**: Prabhupada / Guru Maharaj / Others, minutes and lecture topic (topic goes into Notes/Remark on the card)
- **Book reading**: book covers, chapter/verse and minutes, "Same / Next chapter" shortcuts, add or edit your own books
- **Seva** and **Notes**
- **Dashboard**: weekly totals, average wake-up and bedtime, rounds chart, sleep window chart, reading and hearing chart, streak, 5-week heatmap
- **Weekly Card export**: PDF in the same layout as the paper card (landscape, alternating rows), with an optional week total/average row. Save it to Downloads/Sadhana or share it (WhatsApp, email…). You can also export a whole month as one multi-page PDF.
- **Settings**: name, rounds target, slot labels, which slots count toward "Chanting before 8AM", speakers and short labels (e.g. RNSM), books
- **Daily reminder** notification at your chosen time (skips days already logged), survives phone restarts
- **Backup / Restore** (JSON) and CSV export of all entries

## Build the APK

### Option A: Android Studio
1. Unzip, then open the `SadhanaApp` folder in Android Studio (Ladybug or newer).
2. Let Gradle sync, connect your phone (USB debugging on) and press **Run ▶**.
3. Or use **Build → Build APK(s)**. The APK is written to `app/build/outputs/apk/`.

### Option B: GitHub (no Android Studio needed)
1. Create a GitHub repo and push this folder.
2. The **Build APK** workflow runs automatically (Actions tab).
3. Download the `Sadhana-apk` artifact, copy the APK to your phone and install it (allow "install unknown apps").

Builds are signed with `app/sadhana-release.keystore`, so every new APK installs over the previous one. Keep that file in the repo. For Play Store publishing, use a private key instead.

## Structure
- `app/src/main/assets/www/`: the app itself (HTML/CSS/JS, bundled jsPDF). You can also open `index.html` in a desktop browser to try it.
- `app/src/main/java/.../MainActivity.java`: native shell. It stores data in app-private storage, saves and shares files, picks backup files and handles the back button.

Requires Android 10+.
