const Homey = require('homey');
const { DEVICE_TYPES } = require('../../constants/device_types');
const ManagerDrivers = Homey.ManagerDrivers;
let _devices = [];
let username = '';
let password = '';
module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        Homey.app.log('[Driver] - init', this.id);
        Homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    deviceType() {
        return DEVICE_TYPES.OTHER;
    }

    onPair(socket) {
        const onListDevices = async (data, callback) => {
            try {
                if (this.id.includes('KEYPAD')) {
                    callback(
                        new Error(
                            'The keypad is a physical device to set the security mode for the Homebase. Therefore this has no own functionality in the Homey app. To make flows based on or change security modes please add the homebase instead (if not already done so). There you can find the security modes and flow cards for security modes.'
                        )
                    );
                }

                const _httpService = Homey.app.getHttpService();
                const deviceList = await _httpService.listDevices();

                if (!deviceList.length) {
                    socket.showView('login_credentials');
                } else {
                    _devices = await this.onDeviceListRequest(this.id, deviceList);

                    Homey.app.log(`[Driver] ${this.id} - Found new devices:`, _devices);
                    if (_devices && !!_devices.error) {
                        callback(new Error(_devices.error));
                    } else if (_devices && _devices.length) {
                        callback(null, _devices);
                    } else {
                        callback(new Error('No devices found. Make sure you shared the Eufy devices with your extra account'));
                    }
                }
            } catch (error) {
                socket.showView('login_credentials');
            }
        };

        const onLogin = async (data, callback) => {
            username = data.username;
            password = data.password;

            const settings = await Homey.app.getSettings();
            const result = await Homey.app.eufyLogin({ ...settings, USERNAME: username, PASSWORD: password });
            if (result instanceof Error) return callback(result);
            return socket.showView('list_devices');
        };

        socket.on('list_devices', onListDevices);
        socket.on('login', onLogin);
    }

    // ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
    async onDeviceListRequest(driverId, deviceList) {
        try {
            const deviceType = this.deviceType();
            const driverManifest = this.getManifest();
            const driverCapabilities = driverManifest.capabilities;
            const pairedDriverDevices = [];

            const pairedDevices = await Homey.app.getDevices();

            pairedDevices.forEach((device) => {
                const data = device.getData();
                const driver = device.getDriver();
                pairedDriverDevices.push({ id: data.id, device_sn: data.device_sn, driver_id: driver.id });
            });

            Homey.app.log(`[Driver] ${driverId} - pairedDriverDevices`, pairedDriverDevices);

            if (!driverCapabilities.includes('CMD_SET_ARMING') && !this.id.includes('HOMEBASE') && !pairedDriverDevices.some((p) => p.driver_id.includes('HOMEBASE'))) {
                return {error: 'Please add a Homebase before adding this device'};
            }

            const results = deviceList
                .filter((device) => !pairedDriverDevices.includes(device.device_sn) && deviceType.some((v) => device.device_sn.includes(v)))
                .map((d, i) => ({
                    name: d.device_name,
                    data: {
                        name: d.device_name,
                        index: i,
                        id: `${d.device_sn}-${d.device_id}`,
                        station_sn: d.station_sn,
                        device_sn: d.device_sn
                    }
                }));

            Homey.app.log('Found devices - ', results);

            return Promise.resolve(results);
        } catch (e) {
            Homey.app.log(e);
        }
    }
};
