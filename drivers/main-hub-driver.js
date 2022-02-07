const Homey = require('homey');
const mainDriver = require('./main-driver');
const { DEVICE_TYPES } = require('../../constants/device_types');

let _devices = [];
let username = '';
let password = '';
let errorMsg = null;

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
                
                Homey.app.log(`[Driver] ${this.id} - hubsList:`, hubsList);

                if (!hubsList.length || (('data' in hubsList) && hubsList.data === null)) {
                    errorMsg = Homey.__('pair.no_data');
                    return socket.showView('login_eufy');
                } else {
                    _devices = await this.onDeviceListRequest(this.id, hubsList);

                    Homey.app.log(`[Driver] ${this.id} - Found new devices:`, _devices);
                    if (_devices && _devices.length) {
                        return callback(null, _devices);
                    } else if (_devices && !!_devices.error) {
                        callback(new Error(_devices.error));
                    } else {
                        callback(new Error(Homey.__('pair.no_devices')));
                    }
                }
            } catch (error) {
                Homey.app.log(`[Driver] ${this.id} - Error:`, error);
                socket.showView('login_eufy');
            }
        };

        const onLogin = async (data, callback) => {
            username = data.username;
            password = data.password;

            const settings = Homey.app.appSettings;
            const result = await Homey.app.eufyLogin({ ...settings, USERNAME: username, PASSWORD: password });
            if (result instanceof Error) {
                if(result.message.includes('->')) {
                    const err = new Error(result.message.split('->')[1]);
                    return callback(err); 
                }
            
                return callback(result);
            }
            return socket.showView('list_devices');
        };

        socket.on('showView', async function (viewId) {
            if (errorMsg) {
                Homey.app.log(`[Driver] - Show errorMsg:`, errorMsg);
                socket.emit('error_msg', errorMsg);
                errorMsg = false;
            }
        });

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
                    },
                    settings: {...this.getStationSettings(h)}
                }));

            Homey.app.log('Found devices - ', results);

            return Promise.resolve(results);
        } catch (e) {
            Homey.app.log(e);
        }
    }

    getStationSettings(hub) {
        let hubSettings = {
            HUB_NAME: hub.station_name,
            P2P_DID: hub.p2p_did,
            ACTOR_ID: hub.member.action_user_id,
            STATION_SN: hub.station_sn,
            LOCAL_STATION_IP: hub.ip_addr
        }
       
        return hubSettings;
    }
};
