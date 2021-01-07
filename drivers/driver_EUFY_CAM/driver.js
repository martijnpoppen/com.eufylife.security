const Homey = require('homey');

let devices = [];
let _httpService = undefined;

module.exports = class driver_EUFY_CAM extends Homey.Driver {

    onPair( socket ) {
        socket.on('list_devices', async function( data, callback ) {

            socket.emit('list_devices', [] );
            
            _httpService = Homey.app.getHttpService();
            devices = await onDeviceListVariableAutocomplete()
            if(devices.length) {
                callback( null, devices );
            } else {
                callback( new Error('Something went wrong!') );
            }
        });
    }
}

// ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
async function onDeviceListVariableAutocomplete() {
    try {
        const devices = await _httpService.listDevices();
        const results = devices.map((r, i) => ({ name: r.device_name, data: {id: r.device_id, station_sn: r.station_sn }  }));
      
        Homey.app.log('Found devices - ', results);
      
        return Promise.resolve( results );
    } catch(e) {
        Homey.app.log(e);
    }
}