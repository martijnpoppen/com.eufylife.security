const mainDriver = require('../main-driver');


module.exports = class driver_VIDEO_DOORBELL_2K_POWERED extends mainDriver {
    deviceType() {
        return [...this.homey.app.deviceTypes.VIDEO_DOORBELL_2K_POWERED, ...this.homey.app.deviceTypes.VIDEO_DOORBELL_1080P_POWERED]
    }
}