const Homey = require('homey');

let _devices = [];
let _httpService = undefined;

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        Homey.app.log('[Driver] - init', this.id);
    }

    async onPairListDevices( data, callback ) {
        _httpService = Homey.app.getHttpService();

        _devices = await onDeviceListRequest(this.id);

        Homey.app.log(`[Driver] ${this.id} - Found new devices:`, _devices);
        if(_devices && _devices.length) {
            callback( null, _devices );
        } else {
            callback( new Error('No devices found. Check the login status of this app inside app-settings') );
        }
    }
}

// ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
async function onDeviceListRequest(driverId) {
    try {
        const devices = await _httpService.listDevices();

        // FIX 1.8.4 check for device id, to prevent duplicates.
        let pairedDriverDevices = [];

        Homey.app.getDevices().forEach(device => {
            const data = device.getData();
            pairedDriverDevices.push(data.device_sn);
        })

        Homey.app.log(`[Driver] ${driverId} - pairedDriverDevices`, pairedDriverDevices);

        const results = devices.filter(device => !pairedDriverDevices.includes(device.device_sn))
            .map((r, i) => ({ 
                name: r.device_name, 
                data: {
                    name: r.device_name, 
                    index: i, 
                    id: `${r.device_sn}-${r.device_id}`, 
                    station_sn: r.station_sn, 
                    device_sn: r.device_sn
                }  
            }));
    
        Homey.app.log('Found devices - ', results);
    
        return Promise.resolve( results );
    } catch(e) {
        Homey.app.log(e);
    }
}