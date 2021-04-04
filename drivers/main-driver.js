const Homey = require('homey');
const { DEVICE_TYPES } = require('../../constants/device_types');

let _devices = [];
let _httpService = undefined;

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        Homey.app.log('[Driver] - init', this.id);
        Homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    deviceType() {
        return DEVICE_TYPES.OTHER
    }

    async onPairListDevices( data, callback ) {
        if(this.id.includes('KEYPAD')) {
            callback( new Error('Keypad has no functionality right now. Use the Homebase 2 to change security modes') );
        }

        _httpService = Homey.app.getHttpService();

        _devices = await this.onDeviceListRequest(this.id, _httpService);

        Homey.app.log(`[Driver] ${this.id} - Found new devices:`, _devices);
        if(_devices && _devices.length) {
            callback( null, _devices );
        } else {
            callback( new Error('No devices found. Check the login status of this app inside app-settings') );
        }
    }


    // ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
    async onDeviceListRequest(driverId, httpService) {
        try {
            const deviceList = await httpService.listDevices();
            const deviceType = this.deviceType();

            // FIX 1.8.4 check for device id, to prevent duplicates.
            let pairedDriverDevices = [];

            Homey.app.getDevices().forEach(device => {
                const data = device.getData();
                pairedDriverDevices.push(data.device_sn);
            })

            Homey.app.log(`[Driver] ${driverId} - pairedDriverDevices`, pairedDriverDevices);

            const results = deviceList.filter(device => !pairedDriverDevices.includes(device.device_sn))
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
        
            return Promise.resolve( results );
        } catch(e) {
            Homey.app.log(e);
        }
    }
}