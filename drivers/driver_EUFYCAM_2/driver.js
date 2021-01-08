const Homey = require('homey');
const mainDriver = require('../main-driver');

module.exports = class driver_EUFYCAM_2 extends mainDriver {
    onInit() {        
        Homey.app.log('[Device] - init driver_EUFYCAM_2');
    }
}