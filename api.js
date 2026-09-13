'use strict';

/**
 * The app's Web API.
 *
 * One endpoint, and it exists for one reason: the successor app (`com.eufy`) has to be able to tell
 * whether this app is still installed on the Homey it is pairing on, so it can greet a returning
 * user instead of treating them as new.
 *
 * It is declared `"public": true` in the manifest, which means Homey serves it WITHOUT an
 * authorization token. That is deliberate, and it is what keeps the successor app free of the
 * `homey:manager:api` permission — app-to-app calls through `ManagerApi` need it, a plain HTTP
 * request to a public route needs nothing. The cost of being public is that anything that can reach
 * this Homey can read the answer unauthenticated, so the payload below is the whole payload: which
 * app this is, its version, and how many devices it holds. No device names, no serials, no account,
 * nothing about the user.
 *
 * Reachable at:
 *
 *   GET http://<homey>/api/app/com.eufylife.security/installed
 */

/** The app that replaces this one. Reported so the caller does not have to hard-code the pairing. */
const SUCCESSOR_ID = 'com.eufy';

/**
 * How many devices are paired to this app.
 *
 * Counted per driver and tolerant of one that cannot answer: a driver still starting up throws here,
 * and an undercount is a far better outcome for a greeting than an endpoint that fails outright.
 */
function countDevices(homey) {
    let devices = 0;

    try {
        for (const driver of Object.values(homey.drivers.getDrivers())) {
            try {
                const paired = driver.getDevices();
                devices += Array.isArray(paired) ? paired.length : Object.keys(paired || {}).length;
            } catch (error) {
                // One driver that is not ready must not lose the count of the others.
            }
        }
    } catch (error) {
        return 0;
    }

    return devices;
}

module.exports = {
    /**
     * Answer that this app is installed and running.
     *
     * Reaching this handler at all IS the answer — Homey only routes to an app it has started — so
     * `installed` is unconditionally true. A caller that gets a connection error or a 404 has its
     * answer too: not installed.
     */
    async getInstalled({ homey }) {
        return {
            installed: true,
            id: homey.manifest.id,
            name: 'Eufy Security',
            version: homey.manifest.version,
            deprecated: true,
            successor: SUCCESSOR_ID,
            devices: countDevices(homey)
        };
    }
};
