'use strict';

const Homey = require('homey');

const { EufySecurity, LogLevel } = require('eufy-security-client');
const { PhoneModels } = require('eufy-security-client');

const { DEVICE_TYPES } = require('./constants/device_types.js');
const DEPRECATION = require('./constants/deprecation.js');

const flowActions = require('./lib/flow/actions.js');
const flowConditions = require('./lib/flow/conditions.js');
const flowTriggers = require('./lib/flow/triggers.js');

const eufyEventsHelper = require('./lib/helpers/eufy-events.helper');
const FfmpegManager = require('./lib/helpers/eufy-stream.helper');

const { sleep, randomNumber, normalizeRemoteLines, fetchRemoteText } = require('./lib/utils');

const Logger = require('./lib/helpers/eufy-logger.helper');

const _settingsKey = `${Homey.manifest.id}.settings`;


class App extends Homey.App {
    trace() {
        console.trace.bind(this, '[log]').apply(this, arguments);
    }

    debug() {
        console.debug.bind(this, '[debug]').apply(this, arguments);
    }

    info() {
        console.log.bind(this, '[info]').apply(this, arguments);
    }

    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    warn() {
        console.warn.bind(this, '[warn]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    fatal() {
        console.error.bind(this, '[fatal]').apply(this, arguments);
    }

    // -------------------- INIT ----------------------

    async onInit() {
        try {
            this.debug(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);

            await this.initGlobarVars();
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async initApp() {
        try {
            await this.initSettings();
            await this.sendNotifications();
            await this.copyUserdataFile('ding-dong.mp3');

            this.log('onStartup - Loaded settings', { ...this.appSettings, USERNAME: 'LOG', PASSWORD: 'LOG', PERSISTENT_DATA: 'LOG' });

            if ('USERNAME' in this.appSettings && this.appSettings.USERNAME.length) {
                await this.setEufyClient();
            }
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async initDevices(initial = false) {
        this.homey.app.log('[initDevices] - Initializing devices...');

        this.deviceList.every(async (device, index) => {
            await device.onStartup(initial, index);
        });

        setTimeout(async () => {
            // check eufy stations and check if they are in Homey. if not set the reconnectTimeout to 100000 seconds to prevent reconnecting
            const eufyStations = await this.eufyClient.getStations();

            eufyStations.forEach(async (eufyStation) => {
                const station_sn = eufyStation.getSerial();
                const foundDevice = this.deviceList.find((device) => device.HomeyDevice.station_sn === station_sn);

                if (!foundDevice) {
                    this.log(`initDevices - Station ${station_sn} not found in Homey devices, setting reconnectTimeout to high value to prevent reconnecting`);

                    // eufyStation.reconnectTimeout = 100000000;
                    eufyStation.close();
                }
            });

            // do same for eufu devices
            const eufyDevices = await this.eufyClient.getDevices();

            eufyDevices.forEach(async (eufyDevice) => {
                const device_sn = eufyDevice.getSerial();
                const foundDevice = this.deviceList.find((device) => device.HomeyDevice.device_sn === device_sn);

                if (!foundDevice) {
                    this.log(`initDevices - Device ${device_sn} not found in Homey devices, setting reconnectTimeout to high value to prevent reconnecting`);

                    // eufyDevice.reconnectTimeout = 100000000;
                    eufyDevice.close();
                }
            });
        }, 30000);
    }

    // -------------------- SETTINGS ----------------------

    async initGlobarVars() {
        this.log('initGlobarVars');

        this.settingsInitialized = false;
        this.driversInitialized = false;
        this.flowsInitialized = false;

        this.deviceList = [];
        this.deviceTypes = DEVICE_TYPES;

        this.eufyClientConnected = false;
        this.eufyClient = null;

        this.needCaptcha = null;
        this.need2FA = null;

        // Deprecated in favour of Anker Eufy — see constants/deprecation.js. `sendNotifications` sets
        // this too, but it runs in `initApp`, and a device that starts first would otherwise read an
        // empty banner. The notice is the default state of this app, not something a fetch turns on.
        this.warningText = this.deprecationWarning();

        this.homey.settings.getKeys().forEach((key) => {
            if (key == _settingsKey) {
                this.settingsInitialized = true;
            }
        });
    }

    async initSettings() {
        try {
            if (this.settingsInitialized) {
                this.log('initSettings - Found settings key', _settingsKey);
                this.appSettings = this.homey.settings.get(_settingsKey);

                if (!('PERSISTENT_DATA' in this.appSettings)) {
                    await this.updateSettings({
                        ...this.appSettings,
                        PERSISTENT_DATA: JSON.stringify({})
                    });
                }

                if (!('REGION' in this.appSettings)) {
                    await this.updateSettings({
                        ...this.appSettings,
                        REGION: 'US'
                    });
                }

                if ('HUBS' in this.appSettings) {
                    delete this.appSettings.HUBS;
                    await this.updateSettings(this.appSettings);
                }

                if ('CREDENTIALS' in this.appSettings) {
                    delete this.appSettings.CREDENTIALS;
                    delete this.appSettings.SET_CREDENTIALS;
                    await this.updateSettings(this.appSettings);
                }

                if (!('NOTIFICATIONS' in this.appSettings)) {
                    await this.updateSettings({
                        ...this.appSettings,
                        NOTIFICATIONS: []
                    });
                }

                if (!('TRUSTED_DEVICE_NAME' in this.appSettings)) {
                    const rnd = randomNumber(0, PhoneModels.length);
                    const trustedDeviceName = `${PhoneModels[rnd]}-Homey`;

                    this.log(`initSettings - Setting Trusted Device Name: ${trustedDeviceName}`);

                    await this.updateSettings({
                        ...this.appSettings,
                        TRUSTED_DEVICE_NAME: `${PhoneModels[rnd]}-Homey`
                    });
                }

                if (!('STATION_IPS' in this.appSettings)) {
                    await this.updateSettings({
                        ...this.appSettings,
                        STATION_IPS: {}
                    });
                }

                return true;
            }

            this.log(`initSettings - Initializing ${_settingsKey} with defaults`);
            this.updateSettings({
                USERNAME: '',
                PASSWORD: '',
                REGION: 'US',
                NOTIFICATIONS: [],
                STATION_IPS: {},
                PERSISTENT_DATA: JSON.stringify({})
            });

            return true;
        } catch (err) {
            this.error(err);
        }
    }

    updateSettings(settings) {
        this.debug('updateSettings - New settings:', { ...settings, USERNAME: 'LOG', PASSWORD: 'LOG', PERSISTENT_DATA: 'LOG' });

        this.appSettings = settings;
        this.saveSettings();
    }

    saveSettings() {
        if (typeof this.appSettings === 'undefined') {
            this.log('Not saving settings; settings empty!');
            return;
        }

        this.log('Saved settings.');
        this.homey.settings.set(_settingsKey, this.appSettings);
    }

    /**
     * The device banner saying this app is deprecated, translated where a translation exists.
     *
     * `constants/deprecation.js` holds the English of last resort, so a locale that has not been
     * updated still shows a readable sentence rather than a key.
     */
    deprecationWarning() {
        return this.translated('device.deprecated', DEPRECATION.WARNING_TEXT);
    }

    /** The same message as a timeline notification, which has room to say what the move costs. */
    deprecationNotification() {
        return this.translated('device.deprecated_notification', DEPRECATION.NOTIFICATION_TEXT);
    }

    /**
     * A translation, or the English written into the code when none resolves.
     *
     * Both callers run during app start, where a lookup that throws or answers its own key would
     * otherwise put a raw key on every device tile. Falling back is always readable.
     */
    translated(key, fallback) {
        try {
            const value = this.homey.__(key);

            return value && value !== key ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    async sendNotifications() {
        // Built in rather than fetched, so updating to this build is enough to be told. The remote
        // file below may carry the same id, in which case the dedupe drops it and nobody is told
        // twice; it exists to reach a Homey that never installs this update at all.
        const notifications = [{ id: DEPRECATION.NOTIFICATION_ID, message: this.deprecationNotification() }];

        // Set before the fetch, not after it, so the banner does not depend on the remote files being
        // reachable — or on initGlobarVars having run first.
        this.warningText = this.deprecationWarning();

        try {
            // An incident notice in warning.txt takes the banner over while it is up — replacing the
            // deprecation notice rather than stacking with it, because a device shows one warning and
            // a doubled paragraph is read as neither. Empty or unreachable leaves the notice standing.
            const remoteWarning = (await fetchRemoteText('warning.txt')).trim();

            if (remoteWarning) {
                this.warningText = remoteWarning;
            }

            const notificationsText = await fetchRemoteText('notifications.txt');

            notifications.push(
                ...normalizeRemoteLines(notificationsText)
                    .map((line) => {
                        const [id, ...messageParts] = line.split('|');

                        return {
                            id: id.trim(),
                            message: messageParts.join('|').trim()
                        };
                    })
                    .filter((notification) => notification.id && notification.message)
            );
        } catch (error) {
            // The remote files are an extra reach, not the mechanism. The built-in notice still goes.
            this.log('sendNotifications - could not read the remote notices', error);
        }

        try {
            const sentNotifications = Array.isArray(this.appSettings.NOTIFICATIONS) ? [...this.appSettings.NOTIFICATIONS] : [];
            let didUpdate = false;

            for (const notification of notifications) {
                if (sentNotifications.includes(notification.id)) {
                    continue;
                }

                await this.homey.notifications.createNotification({
                    excerpt: notification.message
                });

                sentNotifications.push(notification.id);
                didUpdate = true;
            }

            if (didUpdate) {
                await this.updateSettings({
                    ...this.appSettings,
                    NOTIFICATIONS: sentNotifications
                });
            }
        } catch (error) {
            this.log('sendNotifications - error', error);
        }
    }

    async initEvents() {
        if (!this.flowsInitialized) {
            this.flowsInitialized = true;

            flowActions.init(this.homey);
            flowConditions.init(this.homey);
            flowTriggers.init(this.homey);

            this.FfmpegManager = new FfmpegManager(this.homey);
            this.eufyEventsHelper = new eufyEventsHelper(this.homey);
        }
    }

    // -------------------- EUFY LOGIN ----------------------

    async eufyLogin(data) {
        try {
            this.log('eufyLogin - New settings:', { ...data, USERNAME: 'LOG', PASSWORD: 'LOG', PERSISTENT_DATA: 'LOG' });
            this.log(`eufyLogin - Found username and password. Logging in to Eufy`);

            await this.updateSettings(data);

            const loggedIn = await this.setEufyClient(true);

            if (loggedIn) {
                this.log('eufyLogin - Succes');
                return true;
            }

            return false;
        } catch (err) {
            this.error(err);
            return err;
        }
    }

    async eufyCaptcha(captchaCode) {
        try {
            this.log(`eufyCaptcha - Found captcha. Logging in to Eufy`);

            const captchaId = this.needCaptcha.id;

            this.needCaptcha = null;

            const loggedIn = await this.checkLogin({
                captcha: {
                    captchaCode,
                    captchaId
                }
            });

            if (loggedIn) {
                this.log('eufyCaptcha - Succes');

                this.eufyClient.writePersistentData();
            } else {
                this.log('eufyCaptcha - Failed');
            }

            return true;
        } catch (err) {
            this.error(err);
            return err;
        }
    }

    async eufy2FA(data) {
        try {
            this.log(`eufy2FA - Found 2FA. Logging in to Eufy`);

            this.need2FA = null;

            const loggedIn = await this.checkLogin({
                verifyCode: data
            });

            if (loggedIn) {
                this.log('eufy2FA - Succes');

                this.eufyClient.writePersistentData();
            } else {
                this.log('eufy2FA - Failed');
            }

            return true;
        } catch (err) {
            this.error(err);
            return err;
        }
    }

    async checkLogin(options = {}) {
        try {
            await this.eufyClient.connect(options);
            this.log('eufyClient connected = ' + this.eufyClient.isConnected());

            return this.eufyClient.isConnected();
        } catch (err) {
            this.log('Error authenticating Eufy : ' + err);

            return false;
        }
    }

    // ---------------------------- eufyClient ----------------------------------
    async setEufyClient(devicesLoaded = false) {
        try {
            const region = this.appSettings.REGION;

            if(region === 'UK' || region === 'EN') {
                this.warn(`setEufyClient - Region is set to ${region}, but Eufy Security ${region} servers are not supported. Changing to a EU country automatically.`);
                await this.updateSettings({
                    ...this.appSettings,
                    REGION: 'EU'
                });
            }

            const config = {
                username: this.appSettings.USERNAME,
                password: this.appSettings.PASSWORD,
                country: this.appSettings.REGION || 'US',
                language: 'EN',
                persistentData: this.appSettings.PERSISTENT_DATA,
                trustedDeviceName: this.appSettings.TRUSTED_DEVICE_NAME,
                fallbackTrustedDeviceName: this.appSettings.TRUSTED_DEVICE_NAME,
                stationIPAddresses: Object.keys(this.appSettings.STATION_IPS).length ? this.appSettings.STATION_IPS : undefined,
                acceptInvitations: true,
                pollingIntervalMinutes: 30,
                eventDurationSeconds: 15,
                p2pConnectionSetup: 2,
                logging: {
                    level: LogLevel.Info
                },
                deviceConfig: {
                    simultaneousDetections: false
                }
            };

            await this.resetEufyClient();

            this.eufyClient = await EufySecurity.initialize(config, Logger.createNew('EufyLibrary', true));

            if (devicesLoaded) {
                // Prevent Eufyclient from getting stuck in (re)-pairing
                this.eufyClient.devicesLoaded = true;
            }

            await this.connectEufyClientHandlers();

            return await this.checkLogin();
        } catch (err) {
            this.error(err);
        }
    }

    async resetEufyClient() {
        if (this.eufyClient) {
            this.warn('resetEufyClient - Resetting EufyClient');
            this.eufyClient.close();
            this.eufyClient = null;
            this.eufyClient = {};
        }

        if (this.deviceList) {
            this.deviceList.forEach((device) => {
                device.setUnavailable(`${device.getName()} ${this.homey.__('device.init')}`);
            });
        }
    }

    connectEufyClientHandlers() {
        this.eufyClient.on('tfa request', () => {
            this.warn('Event: tfa request (2FA)');

            const notification = !this.need2FA;
            this.need2FA = true;

            if (notification) {
                this.homey.notifications.createNotification({
                    excerpt: 'Eufy Security - 2FA required'
                });
            }
        });

        this.eufyClient.on('captcha request', (id, captcha) => {
            this.warn('Event: captcha request', id);
            const notification = !this.needCaptcha;
            this.needCaptcha = {
                captcha,
                id
            };

            if (notification) {
                this.homey.notifications.createNotification({
                    excerpt: 'Eufy Security - Captcha required'
                });
            }
        });

        this.eufyClient.on('connection error', (error) => {
            this.eufyClientError = error && error.context && error.context.message;
            this.warn('Event: connection error', this.eufyClientError);
        });

        this.eufyClient.on('persistent data', async (data) => {
            this.warn('Event: persistent data');

            await this.updateSettings({
                ...this.appSettings,
                PERSISTENT_DATA: data
            });
        });

        this.eufyClient.once('connect', async () => {
            this.warn('Event: connected');

            await sleep(1000);
            await this.initEvents();
            await sleep(2000);
            await this.initDevices(true);
        });
    }

    async setDevice(device) {
        this.deviceList = [...this.deviceList.filter((dl) => dl.getData().device_sn !== device.getData().device_sn), device];

        await this.eufyEventsHelper.setDevices(this.deviceList);
    }

    async replaceDevice(device) {
        const filteredDeviceList = this.deviceList.filter((dl) => {
            const data = dl.getData();
            return data.device_sn !== device.getData().device_sn;
        });
        this.deviceList = [...filteredDeviceList, device];

        await this.eufyEventsHelper.setDevices(this.deviceList);
    }

    async setDevices(devices) {
        this.deviceList = [...this.deviceList, ...devices];

        if (!this.driversInitialized) {
            this.driversInitialized = true;
            await sleep(2000);
            this.initApp();
        }
    }

    async removeDevice(device_sn) {
        try {
            this.homey.app.debug('removeDevice', device_sn);

            const filteredList = this.deviceList.filter((dl) => {
                const data = dl.getData();
                return data.device_sn !== device_sn;
            });

            this.deviceList = filteredList;
        } catch (error) {
            this.error(error);
        }
    }

    async copyUserdataFile(file) {
        const fs = require('fs');
        const path = require('path');
        const persistentDir = path.resolve(__dirname, '/userdata/');
        const localDir = path.resolve('./userdata/');

        this.log('copyUserdataFile', file);

        try {
            await fs.promises.copyFile(path.resolve(localDir, file), path.resolve(persistentDir, file));
        } catch (error) {
            this.error('copyUserdataFile - error', error);
        }
    }
}

module.exports = App;
