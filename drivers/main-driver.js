const Homey = require('homey');
const { sleep } = require('../lib/utils.js');

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id);
        
        this.homey.app.setDevices(this.getDevices());
    }

    deviceType() {
        return this.homey.app.deviceTypes.OTHER;
    }

    async onPair(session) {
        this.deviceError = false;
        this._devices = [];

        session.setHandler('showView', async (view) => {
            this.homey.app.log(`[Driver] ${this.id} - currentView:`, view);

            if (view === 'login_eufy' && this.homey.app.eufyClient.isConnected() && !this.deviceError) {
                session.nextView();
                return true;
            }

            if (view === 'loading') {
                this.deviceList = await waitForResults(this);

                this.homey.app.log(`[Driver] ${this.id} - deviceList:`, this.deviceList.length, !!this.deviceList.length);

                session.nextView();
                return true;
            }
        });

        session.setHandler('login', async (data) => {
            const username = data.username;
            const password = data.password;

            const settings = this.homey.app.appSettings;
            const result = await this.homey.app.eufyLogin({ ...settings, USERNAME: username, PASSWORD: password, REGION: data.region });
            if (result === false) {
                throw new Error(this.homey.__('pair.no_data'));
            }

            return result;
        });

        session.setHandler('list_devices', async () => {
            try {
                if (this.id.includes('KEYPAD')) {
                    throw new Error(this.homey.__('pair.keypad'));
                }

                this._devices = await this.onDeviceListRequest(this.id);

                this.homey.app.log(`[Driver] ${this.id} - Found new devices:`, this._devices);

                if (this._devices && this._devices.length) {
                    return this._devices;
                } else if (this._devices && !!this._devices.error) {
                    throw new Error(this._devices.error);
                } else {
                    throw new Error(this.homey.__('pair.no_devices'));
                }
            } catch (error) {
                this.homey.app.log(`[Driver] ${this.id} - Error:`, error);
                this.deviceError = true;
                throw new Error(error);
            }
        });

        async function waitForResults(ctx, retry = 10) {
            for (let i = 1; i <= retry; i++) {
                ctx.homey.app.log(`[Driver] ${ctx.id} - eufyDeviceData - try: ${i}`);
                await sleep(500);
                const eufyDevices = await ctx.homey.app.eufyClient.getDevices();

                if (eufyDevices.length) {
                    return Promise.resolve(eufyDevices);
                } else if (retry === 9) {
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
                return { error: 'Please add a Homebase before adding this device' };
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
