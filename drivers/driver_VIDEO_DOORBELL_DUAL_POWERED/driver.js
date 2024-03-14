const mainDriver = require('../main-driver');


module.exports = class driver_VIDEO_DOORBELL_DUAL_POWERED extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.VIDEO_DOORBELL_DUAL_POWERED
    }
}