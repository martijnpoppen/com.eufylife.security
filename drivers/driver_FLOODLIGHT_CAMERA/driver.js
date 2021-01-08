const Homey = require('homey');
const mainDriver = require('../main-driver');

module.exports = class driver_FLOODLIGHT_CAMERA extends mainDriver {
    onInit() {        
        Homey.app.log('[Device] - init driver_FLOODLIGHT_CAMERA');
    }
}