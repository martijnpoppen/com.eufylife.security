'use strict';

/**
 * This app is deprecated, and everything that says so.
 *
 * It is replaced by **Anker Eufy** (`com.eufy`), which covers the same cameras, doorbells,
 * HomeBases, locks, keypads and sensors — plus the robot vacuums that used to need Eufy Clean — in
 * one app. This app still works, and is meant to keep working while people move across, so nothing
 * here makes a device unavailable or blocks a Flow. It informs; it does not punish.
 *
 * The notice reaches a user three ways, because no single one reaches everybody:
 *
 *   - a Homey timeline notification, once, the first time a build carrying {@link NOTIFICATION_ID}
 *     runs (see `sendNotifications` in app.js);
 *   - a warning banner on every device, which is what somebody still using the app sees daily;
 *   - the App Store listing and README, which is what somebody about to INSTALL it sees.
 *
 * The first two are also served remotely from `notifications.txt` and `warning.txt` on `main`, so
 * they reach a Homey that never installs this update. The strings below are the offline fallback for
 * the same messages, and the notification deliberately shares its id with the line in
 * `notifications.txt`: whichever arrives first wins and the other is skipped, so nobody is told
 * twice.
 *
 * Translations live in `locales/*.json` under `device.deprecated` and `device.deprecated_notification`.
 * These constants are the English of last resort, for a lookup that does not resolve.
 */

/** The app that replaces this one, as a user will find it in the Homey App Store. */
const SUCCESSOR_NAME = 'Anker Eufy';

/** Its app id, for anything that addresses it rather than names it. */
const SUCCESSOR_ID = 'com.eufy';

/**
 * Dedupe key for the one-time notification.
 *
 * Stored in the app's `NOTIFICATIONS` setting once sent. Changing it tells every existing install to
 * send the notice AGAIN, so change it only when there is genuinely something new to say — not to fix
 * a typo.
 */
const NOTIFICATION_ID = 'deprecation-anker-eufy-2026';

/**
 * The device banner. Short on purpose: it renders on a device tile, next to the controls.
 *
 * No URL. A banner is glanceable, not clickable, and the app name is what someone types into the
 * App Store search.
 */
const WARNING_TEXT = `This app is deprecated and no longer being developed. Install "${SUCCESSOR_NAME}" from the Homey App Store and add your devices there.`;

/**
 * The timeline notification, sent once.
 *
 * Longer than the banner because it is read once and has room to say what the move actually costs.
 * It carries no link on purpose: a one-time notification cannot be corrected for anyone who has
 * already received it, and the App Store URL depends on the successor being published. The name is
 * searchable, and README.txt carries the link.
 */
const NOTIFICATION_TEXT = `[Eufy Security] This app is deprecated and no longer being developed. Its replacement, ${SUCCESSOR_NAME}, is in the Homey App Store: it covers the same cameras, doorbells, HomeBases, locks, keypads and sensors, and the robot vacuums that needed Eufy Clean. Install it, add your devices there, and remove this app once your Flows are rebuilt. Both apps can run side by side while you move across, and ${SUCCESSOR_NAME} no longer needs a second eufy account.`;

module.exports = {
    SUCCESSOR_NAME,
    SUCCESSOR_ID,
    NOTIFICATION_ID,
    WARNING_TEXT,
    NOTIFICATION_TEXT
};
