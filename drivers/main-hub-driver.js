const Homey = require('homey');
const mainDriver = require('./main-driver');
const { DEVICE_TYPES } = require('../../constants/device_types');

let _devices = [];
let username = '';
let password = '';
module.exports = class mainHubDriver extends mainDriver {
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
                const _httpService = Homey.app.getHttpService();
                const hubsList = await _httpService.listHubs();

                if (!hubsList.length) {
                    socket.showView('login_credentials');
                } else {
                    _devices = await this.onDeviceListRequest(this.id, hubsList);

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
    async onDeviceListRequest(driverId, hubsList) {
        try {
            const deviceType = this.deviceType();
            const deviceList = await Homey.app.getDevices();
            const pairedDevicesArray = [];

            deviceList.forEach((device) => {
                const data = device.getData();
                pairedDevicesArray.push(data.device_sn);
            });

            Homey.app.log(`[Driver] ${driverId} - pairedDevicesArray`, pairedDevicesArray);

            const results = hubsList
                .filter((hub) => deviceType.some((v) => hub.station_sn.includes(v)))
                .map((h, i) => ({
                    name: h.station_name,
                    data: {
                        name: h.station_name,
                        index: i,
                        id: `${h.station_sn}-${h.station_id}`,
                        station_sn: h.station_sn,
                        device_sn: h.station_sn
                    }
                }));

            Homey.app.log('Found devices - ', results);

            return Promise.resolve(results);
        } catch (e) {
            Homey.app.log(e);
        }
    }
};
