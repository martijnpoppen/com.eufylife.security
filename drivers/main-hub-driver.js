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

            if(view === 'login_eufy') {
                this.appSettings = this.homey.app.appSettings;

                if(this.appSettings && this.appSettings.USERNAME) {
                    await session.emit('set_user', this.appSettings.USERNAME);
                }

                if(this.appSettings && this.appSettings.PASSWORD) {
                    await session.emit('set_password', this.appSettings.PASSWORD);
                }
            }

            if (view === 'login_eufy' && this.homey.app.eufyClient.isConnected() && !this.deviceError) {
                session.nextView();
                return true;
            } else if(view === 'login_eufy' && this.deviceError) {
                await session.emit('deviceError', this.deviceError);
                this.deviceError = false;
            }
            
            if (view === 'loading') {
                this.deviceList = await waitForResults(this);

                this.homey.app.log(`[Driver] ${this.id} - deviceList:`, this.deviceList.length, !!this.deviceList.length);


                if(this.deviceList.length) {
                    session.nextView();
                } else if(this.deviceError) {
                    session.showView('login_eufy')

                    return [];
                } else {
                    this.deviceError = this.homey.__('pair.no_devices');
                    session.showView('login_eufy')

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

        session.setHandler('list_devices', async () => {
            try {
                this._devices = await this.onDeviceListRequest(this.id);

                this.homey.app.log(`[Driver] ${this.id} - Found new devices:`, this._devices);

                if (this._devices && this._devices.length) {
                    return this._devices;
                } else {
                    this.deviceError = this.homey.__('pair.no_devices');

                    session.showView('login_eufy');
                    return [];
                }
            } catch (error) {
                this.homey.app.log(`[Driver] ${this.id} - Error:`, error);
                this.deviceError = error;

                session.showView('login_eufy');
                return [];
            }
        });

        async function waitForResults(ctx, retry = 10) {
            for (let i = 1; i <= retry; i++) {
                ctx.homey.app.log(`[Driver] ${ctx.id} - eufyDeviceData - try: ${i}`);
                await sleep(500);
                const eufyDevices = await ctx.homey.app.eufyClient.getStations();

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

            const deviceList = await this.homey.app.deviceList;
            const pairedDevicesArray = [];

            deviceList.forEach((device) => {
                const data = device.getData();

                pairedDevicesArray.push(data.station_sn);
            });

            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - pairedDevicesArray`, pairedDevicesArray);

            const results = this.deviceList
                .filter((device) => !pairedDevicesArray.includes(device.rawStation.station_sn))
                .filter((device) => deviceType.some((v) => device.rawStation.station_sn.includes(v)))
                .map((d, i) => ({
                    name: d.rawStation.station_name,
                    data: {
                        name: d.rawStation.station_name,
                        index: i,
                        id: `${d.rawStation.station_sn}-${d.rawStation.station_id}`,
                        station_sn: d.rawStation.station_sn,
                        device_sn: d.rawStation.station_sn
                    },
                    settings: { STATION_SN: d.rawStation.station_sn }
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
