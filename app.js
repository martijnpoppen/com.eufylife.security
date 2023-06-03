'use strict';

const Homey = require('homey');
const path = require('path');

const { EufySecurity } = require('eufy-security-client');
const { PhoneModels } = require('eufy-security-client/build/http/const');

const { DEVICE_TYPES } = require('./constants/device_types.js');

const flowActions = require('./lib/flow/actions.js');
const flowConditions = require('./lib/flow/conditions.js');
const flowTriggers = require('./lib/flow/triggers.js');
const eufyNotificationCheckHelper = require('./lib/helpers/eufy-notification-check.helper');
const eufyEventsHelper = require('./lib/helpers/eufy-events.helper');

const { sleep, randomNumber } = require('./lib/utils');

const Logger = require('./lib/helpers/eufy-logger.helper');

const _settingsKey = `${Homey.manifest.id}.settings`;

class App extends Homey.App {
    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    // -------------------- INIT ----------------------

    async onInit() {
        try {
            this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

            await this.initGlobarVars();
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async initApp() {
        try {
            await sleep(2000);
            await this.initSettings();

            this.log('onStartup - Loaded settings', { ...this.appSettings, USERNAME: 'LOG', PASSWORD: 'LOG' });

            this.initEufyClient();
            this.sendNotifications();
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async initDevices(initial = false) {
        this.deviceList.every(async (device, index) => {
            await device.onStartup(initial, index);
        });
    }

    // -------------------- SETTINGS ----------------------

    async initGlobarVars() {
        this.log('initGlobarVars');

        this.settingsInitialized = false;
        this.driversInitialized = false;
        this.flowsInitialized = false;

        this.deviceList = [];
        this.deviceTypes = DEVICE_TYPES;

        this.eufyRegionSwitchAllowed = false;
        this.eufyClientConnected = false;
        this.eufyClient = null;

        this.needCaptcha = null;
        this.need2FA = null;

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

                if ('REGION' in this.appSettings && this.appSettings['REGION'] === 'EU') {
                    this.log('initSettings - Set REGION to NL');

                    await this.updateSettings({
                        ...this.appSettings,
                        REGION: 'NL'
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
                STATION_IPS: {}
            });

            return true;
        } catch (err) {
            this.error(err);
        }
    }

    updateSettings(settings) {
        this.log('updateSettings - New settings:', { ...settings, USERNAME: 'LOG', PASSWORD: 'LOG' });

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

    async sendNotifications() {
        try {
            const ntfy2023050701 = `[Eufy Security] (1/3) - Notification Images are fixed again`;
            const ntfy2023050702 = `[Eufy Security] (2/3) - Unfortunately Cloud streams are patched again by Eufy and ported to WebRTC`;
            const ntfy2023050703 = `[Eufy Security] (3/3) For more info go to: https://tinyurl.com/eufy-homey`;

            if (!this.appSettings.NOTIFICATIONS.includes('ntfy2023050701')) {
                await this.homey.notifications.createNotification({
                    excerpt: ntfy2023050703
                });

                await this.homey.notifications.createNotification({
                    excerpt: ntfy2023050702
                });

                await this.homey.notifications.createNotification({
                    excerpt: ntfy2023050701
                });

                await this.updateSettings({
                    ...this.appSettings,
                    NOTIFICATIONS: [...this.appSettings.NOTIFICATIONS, 'ntfy2023050701', 'ntfy2023050702', 'ntfy2023050703']
                });
            }
        } catch (error) {
            this.log('sendNotifications - error', console.error());
        }
    }

    async initEvents() {
        if (!this.flowsInitialized) {
            this.flowsInitialized = true;

            flowActions.init(this.homey);
            flowConditions.init(this.homey);
            flowTriggers.init(this.homey);

            this.eufyNotificationCheckHelper = new eufyNotificationCheckHelper(this.homey);
            this.eufyEventsHelper = new eufyEventsHelper(this.homey);
        }
    }

    // -------------------- EUFY LOGIN ----------------------

    async eufyLogin(data) {
        try {
            this.log('eufyLogin - New settings:', { ...data, USERNAME: 'LOG', PASSWORD: 'LOG' });
            this.log(`eufyLogin - Found username and password. Logging in to Eufy`);

            await this.updateSettings(data);

            const loggedIn = await this.setEufyClient(data, true);

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

    async initEufyClient() {
        if ('USERNAME' in this.appSettings && this.appSettings.USERNAME.length) {
            this.eufyRegionSwitchAllowed = true;

            await this.setEufyClient(this.appSettings);
        }
    }

    async setEufyClient(settings, devicesLoaded = false) {
        try {
            const debug = false;

            const config = {
                username: settings.USERNAME,
                password: settings.PASSWORD,
                country: settings.REGION,
                language: 'EN',
                persistentDir: path.resolve(__dirname, '/userdata/'),
                trustedDeviceName: settings.TRUSTED_DEVICE_NAME,
                fallbackTrustedDeviceName: settings.TRUSTED_DEVICE_NAME,
                stationIPAddresses: Object.keys(settings.STATION_IPS).length ? settings.STATION_IPS : undefined,
                acceptInvitations: true,
                pollingIntervalMinutes: 15
            };

            await this.resetEufyClient();

            this.libraryLog = Logger.createNew('EufyLibrary', debug);
            this.eufyClient = await EufySecurity.initialize(config, this.libraryLog);

            if(devicesLoaded) {
                // Prevent Eufyclient from getting stuck in (re)-pairing
                this.eufyClient.devicesLoaded = true
            }

            await this.connectEufyClientHandlers();

            return await this.checkLogin();
        } catch (err) {
            this.error(err);
        }
    }

    async resetEufyClient() {
        if (this.eufyClient) {
            this.log('resetEufyClient - Resetting EufyClient');
            this.eufyClient.close();
            this.eufyClient = null;
            this.eufyClient = {};
        }

        if(this.deviceList) {
            this.deviceList.forEach(device => {
                device.setUnavailable(`${device.getName()} ${this.homey.__('device.init')}`);
            });
        }
    }

    connectEufyClientHandlers() {
        this.eufyClient.on('tfa request', () => {
            this.log('Event: tfa request (2FA)');
            console.log('Event: devicesLoaded', this.eufyClient.devicesLoaded);
            this.need2FA = true;
        });
        this.eufyClient.on('captcha request', (id, captcha) => {
            this.log('Event: captcha request', id);
            console.log('Event: devicesLoaded', this.eufyClient.devicesLoaded);
            this.needCaptcha = {
                captcha,
                id
            };
        });
        this.eufyClient.on('connect', async () => {
            this.log('Event: connected');

            this.switchRegions();
        });
    }

    async switchRegions() {
        await sleep(4000);
        const eufyDevices = await this.eufyClient.getDevices();

        this.log('switchRegions', { region: this.appSettings.REGION, eufyRegionSwitchAllowed: this.eufyRegionSwitchAllowed, deviceList: this.deviceList.length, eufyDevices: eufyDevices.length });

        if (this.eufyRegionSwitchAllowed && this.deviceList.length && !eufyDevices.length) {
            const REGION = this.appSettings.REGION === 'US' ? 'NL' : 'US';

            this.eufyRegionSwitchAllowed = false;

            this.log('switchRegions restart eufyClient with region: ', REGION);

            await this.updateSettings({
                ...this.appSettings,
                REGION: REGION
            });

            await sleep(200);

            this.setEufyClient(this.appSettings);
        } else {
            this.eufyRegionSwitchAllowed = false;
            this.eufyClientConnected = true;

            await sleep(4000);

            await this.initDevices(true);

            await this.initEvents();
        }
    }

    async setDevice(device) {
        this.deviceList = [...this.deviceList, device];

        await this.eufyNotificationCheckHelper.setDevices(this.deviceList);
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
            this.homey.app.log('removeDevice', device_sn);

            const filteredList = this.deviceList.filter((dl) => {
                const data = dl.getData();
                return data.device_sn !== device_sn;
            });

            this.deviceList = filteredList;
        } catch (error) {
            this.error(error);
        }
    }

    /// ----------------- Streaming --------------------
    async getStreamAddress() {
        try {
            let homeyCloudId = await this.homey.cloud.getHomeyId();
            this.log(`getStreamAddress - Set homeyCloudId`, homeyCloudId);

            return `https://${homeyCloudId}.connect.athom.com`;
        } catch (error) {
            this.error(error);
        }
    }

    async getStreamUrl(device_sn) {
        try {
            const pairedDevices = this.homey.app.deviceList;
            const device = pairedDevices.find((d) => {
                const data = d.getData();
                this.log(`getStreamUrl - device_sn`, device_sn);
                this.log(`getStreamUrl - data`, data);

                return data.device_sn === device_sn;
            });

            const settings = device.getSettings();
            this.log(`getStreamUrl - settings`, settings);
            return settings.CLOUD_STREAM_URL ? settings.CLOUD_STREAM_URL : null;
        } catch (error) {
            this.error(error);
        }
    }
}

module.exports = App;
