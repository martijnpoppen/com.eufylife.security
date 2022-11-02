const Homey = require('homey');
const { sleep } = require('../lib/utils.js');

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id, this.driverType());
        
        this.homey.app.setDevices(this.getDevices());
    }

    deviceType() {
        return this.homey.app.deviceTypes.OTHER;
    }

    driverType() {
        return 'devices';
    }

    async onPair(session) {
       this.setPairingSession(session, 'pair')
    }

    async onRepair(session) {
        this.setPairingSession(session, 'repair')
    }

    async setPairingSession(session, type) {
        this.deviceError = false;
        this._devices = [];
        this.type = type;

        session.setHandler('showView', async (view) => {
            this.homey.app.log(`[Driver] ${this.id} - currentView:`, view, this.deviceError);

            if(view === 'login_eufy') {
                if (this.id.includes('KEYPAD')) {
                    this.deviceError = this.homey.__('pair.keypad');
                    
                    session.showView('error');
                    return true;
                }

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
            } 

            if(view === 'login_captcha' && this.homey.app.needCaptcha) {
                await session.emit('set_captcha', this.homey.app.needCaptcha.captcha);
            }
            
            if(view === 'error' && this.deviceError) {
                await session.emit('deviceError', this.deviceError);
            }
            
            if (view === 'loading') {
                this.deviceList = await waitForResults(this);

                this.homey.app.log(`[Driver] ${this.id} - deviceList:`, this.deviceList.length, !!this.deviceList.length);

                if(!!this.deviceList.length) {
                    session.nextView();
                } else if(this.homey.app.needCaptcha) {
                    this.homey.app.log(`[Driver] ${this.id} - needCaptcha`);
                    session.showView('login_captcha')

                    return [];
                } else {
                    this.deviceError = this.homey.__('pair.no_devices');
                    session.showView('error')

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
            const result = await this.homey.app.eufyCaptcha(data.captcha);

            this.deviceError = false;

            await sleep(3000);
            
            session.showView('loading')

            return result;
        });

        session.setHandler('list_devices', async () => {
            try {
                if(this.type === 'repair') {
                    this.homey.app.log(`[Driver] ${this.id} - list_devices: repair mode -> Closing repair`);
                    return session.showView('done');
                }

                this._devices = await this.onDeviceListRequest(this.id);

                this.homey.app.log(`[Driver] ${this.id} - Found new devices:`, this._devices);

                if (this._devices && this._devices.length) {
                    return this._devices;
                } else if (this._devices && !!this._devices.info) {
                    this.deviceError = this._devices.info;
                    
                    session.showView('error');
                } else {
                    this.deviceError = this.homey.__('pair.no_devices');
                    
                    session.showView('error');
                }
            } catch (error) {
                this.homey.app.log(`[Driver] ${this.id} - Error:`, error);
                this.deviceError = error;

                session.showView('error');
            }
        });

        async function waitForResults(ctx, retry = 10) {
            for (let i = 1; i <= retry; i++) {
                ctx.homey.app.log(`[Driver] ${ctx.id} - eufyDeviceData - try: ${i}`);
                await sleep(500);

                let eufyDevices = []

                if(ctx.driverType() === 'stations') {
                    eufyDevices = await ctx.homey.app.eufyClient.getStations();
                } else {
                    eufyDevices = await ctx.homey.app.eufyClient.getDevices();
                }
                

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
