const Homey = require('homey');

module.exports = class driver_VIDEO_DOORBELL_1080P_POWERED extends mainDriver {
    onInit() {        
        Homey.app.log('[Device] - init driver_VIDEO_DOORBELL_1080P_POWERED');
    }
}