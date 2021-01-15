const Homey = require('homey');

let _devices = [];
let _httpService = undefined;

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        Homey.app.log('[Driver] - init', this.id);
    }

    async onPairListDevices( data, callback ) {
        _httpService = Homey.app.getHttpService();
            
        _devices = await onDeviceListRequest();
        if(_devices && _devices.length) {
            callback( null, _devices );
        } else {
            callback( new Error('Something went wrong!') );
        }
    }
}

// ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
async function onDeviceListRequest() {
    try {
        const devices = await _httpService.listDevices();
        const results = devices.map((r, i) => ({ 
                name: r.device_name, 
                data: {
                    name: r.device_name, 
                    index: i, 
                    id: r.device_id, 
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