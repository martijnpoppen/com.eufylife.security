const Homey = require('homey');
const { sleep } = require('../lib/utils.js');

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log(`[Driver] - init: ${this.id} - type: ${this.driverType()}`);

        this.homey.app.setDevices(this.getDevices());
    }

    deviceType() {
        return this.homey.app.deviceTypes.OTHER;
    }

    driverType() {
        return 'devices';
    }

    async onPair(session) {
        this.type = 'pair';
        this.setPairingSession(session);
    }

    async onRepair(session) {
        this.type = 'repair';
        this.setPairingSession(session);
    }

    async setPairingSession(session) {
        this.deviceError = false;
        this._devices = [];

        session.setHandler('showView', async (view) => {
            this.homey.app.log(`[Driver] ${this.id} - currentView:`, { view, type: this.type, deviceError: this.deviceError });

            if (view === 'login_eufy' && this.id.includes('KEYPAD')) {
                this.deviceError = this.homey.__('pair.keypad');

                session.showView('error');
                return true;
            }

            if (view === 'login_eufy') {
                this.appSettings = this.homey.app.appSettings;

                if (this.appSettings && this.appSettings.USERNAME && this.appSettings.PASSWORD) {
                    session.emit('set_user', this.appSettings.USERNAME);
                    session.emit('set_password', this.appSettings.PASSWORD);
                }
            }

            if (view === 'login_eufy' && this.homey.app.eufyClient.isConnected() && !this.deviceError && this.type === 'pair') {
                session.showView('loading');
                return true;
            }

            if (view === 'login_captcha' && this.homey.app.needCaptcha) {
                await session.emit('set_captcha', this.homey.app.needCaptcha.captcha);
            }

            if (view === 'error' && this.deviceError) {
                await session.emit('deviceError', this.deviceError);
            }

            if (view === 'loading') {
                await sleep(3000);
                this.deviceList = await waitForResults(this);

                this.homey.app.log(`[Driver] ${this.id} - deviceList:`, this.deviceList.length, !!this.deviceList.length);

                if (this.homey.app.needCaptcha) {
                    this.homey.app.log(`[Driver] ${this.id} - needCaptcha`);
                    session.showView('login_captcha');

                    return [];
                } else if (this.homey.app.need2FA) {
                    this.homey.app.log(`[Driver] ${this.id} - need2FA`);
                    session.showView('pincode');

                    return [];
                } else if (!!this.deviceList.length) {
                    this._devices = await this.onDeviceListRequest(this.id);

                    this.homey.app.log(`[Driver] ${this.id} - Found new devices:`, this._devices);

                    if (this.type === 'repair') {
                        this.homey.app.homeyEvents.emit('eufyClientConnectedRepair');
                        this.homey.app.log(`[Driver] ${this.id} - list_devices: repair mode -> Closing repair`);
                        return session.showView('done');
                    } else if (this._devices && this._devices.length) {
                        session.showView('list_devices');
                    } else if (this._devices && !!this._devices.info) {
                        this.deviceError = this._devices.info;

                        session.showView('error');
                    } else {
                        this.deviceError = this.homey.__('pair.no_devices');

                        session.showView('error');
                    }
                } else {
                    this.deviceError = this.type === 'repair' ? this.homey.__('pair.no_devices_repair') : this.homey.__('pair.no_devices');
                    session.showView('error');

                    return [];
                }

                return true;
            }
        });

        session.setHandler('login', async (data) => {
            const username = data.username;
            const password = data.password;

            const settings = this.homey.app.appSettings;
            const result = await this.homey.app.eufyLogin({ ...settings, USERNAME: username, PASSWORD: password, REGION: data.region });
            if (result === false) {
                this.deviceError = this.homey.__('pair.no_data');
            }

            return result;
        });

        session.setHandler('login_captcha', async (data) => {
            this.homey.app.eufyCaptcha(data.captcha);

            this.deviceError = false;

            return true;
        });

        session.setHandler('pincode', async (data) => {
            this.homey.app.eufy2FA(data.join(''));

            this.deviceError = false;

            return true;
        });

        session.setHandler('list_devices', async () => {
            try {
                return this._devices;
            } catch (error) {
                this.homey.app.log(`[Driver] ${this.id} - Error:`, error);
                this.deviceError = error;

                session.showView('error');
            }
        });

        async function waitForResults(ctx, retry = 10) {
            for (let i = 1; i <= retry; i++) {
                ctx.homey.app.log(`[Driver] ${ctx.id} - eufyDeviceData - try: ${i}`);
                await sleep(1000);

                let eufyDevices = [];

                if (ctx.driverType() === 'stations') {
                    eufyDevices = await ctx.homey.app.eufyClient.getStations();
                } else {
                    eufyDevices = await ctx.homey.app.eufyClient.getDevices();
                }

                if (eufyDevices.length) {
                    return Promise.resolve(eufyDevices);
                } else if (i === 10) {
                    return Promise.resolve([]);
                }
            }

            return Promise.resolve([]);
        }
    }

    // ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
    async onDeviceListRequest(driverId) {
        try {
            const deviceType = this.deviceType();
            const driverManifest = this.manifest;
            const driverCapabilities = driverManifest.capabilities;

            const deviceList = await this.homey.app.deviceList;
            const pairedDevicesArray = [];
            let homebasePaired = false;

            deviceList.forEach((device) => {
                const data = device.getData();
                const driver = device.driver;

                pairedDevicesArray.push(data.device_sn);

                if (driver.id.includes('HOMEBASE')) {
                    homebasePaired = true;
                }
            });

            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - pairedDevicesArray`, pairedDevicesArray);
            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - homebasePaired`, homebasePaired);

            if (!driverCapabilities.includes('CMD_SET_ARMING') && !this.id.includes('HOMEBASE') && !homebasePaired) {
                return { info: 'Please add a Homebase before adding this device' };
            }

            const results = this.deviceList
                .filter((device) => !pairedDevicesArray.includes(device.rawDevice.device_sn))
                .filter((device) => deviceType.some((v) => device.rawDevice.device_sn.includes(v)))
                .map((d, i) => ({
                    name: d.rawDevice.device_name,
                    data: {
                        name: d.rawDevice.device_name,
                        index: i,
                        id: `${d.rawDevice.device_sn}-${d.rawDevice.device_id}`,
                        station_sn: d.rawDevice.station_sn,
                        device_sn: d.rawDevice.device_sn
                    },
                    settings: { STATION_SN: d.rawDevice.station_sn }
                }));

            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - Found devices - `, results);

            return Promise.resolve(results);
        } catch (e) {
            this.homey.app.log('Error when trying to connect new device', e);

            if (typeof e === 'object') {
                return Promise.reject(JSON.stringify(e));
            }
        }
    }
};
