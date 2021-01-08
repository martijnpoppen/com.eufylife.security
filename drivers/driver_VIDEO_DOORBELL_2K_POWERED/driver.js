const Homey = require('homey');
const mainDriver = require('../main-driver');

module.exports = class driver_VIDEO_DOORBELL_2K_POWERED extends mainDriver {
    onInit() {        
        Homey.app.log('[Device] - init driver_VIDEO_DOORBELL_2K_POWERED');
    }
}