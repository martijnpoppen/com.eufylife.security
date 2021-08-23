const Homey = require('homey');
const mainDriver = require('./main-driver');

module.exports = class mainHubDriver extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.UNKOWN
    }

    // ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
    async onDeviceListRequest(driverId, _httpService) {
        try {
            const hubsList = await _httpService.listHubs();
            const deviceType = this.deviceType();

            // FIX 1.8.4 check for device id, to prevent duplicates.
            let pairedDriverDevices = [];

            Homey.app._devices.forEach(device => {
                const data = device.getData();
                pairedDriverDevices.push(data.device_sn);
            })

            Homey.app.log(`[Driver] ${driverId} - pairedDriverDevices`, pairedDriverDevices);

            const results = hubsList.filter(hub => !pairedDriverDevices.includes(hub.station_sn) && deviceType.some(v => hub.station_sn.includes(v)))
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
        
            return Promise.resolve( results );
        } catch(e) {
            Homey.app.log(e);
        }
    }
}