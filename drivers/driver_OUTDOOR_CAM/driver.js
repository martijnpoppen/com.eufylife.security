const mainDriver = require('../main-driver');


module.exports = class driver_OUTDOOR_CAM extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.OUTDOOR_CAM
    }
}