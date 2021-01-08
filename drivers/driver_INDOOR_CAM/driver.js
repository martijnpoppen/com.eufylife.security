const Homey = require('homey');

module.exports = class driver_INDOOR_CAM extends mainDriver {
    onInit() {        
        Homey.app.log('[Device] - init driver_INDOOR_CAM');
    }
}