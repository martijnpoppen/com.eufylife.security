const mainDriver = require('../main-driver');


module.exports = class driver_FLOODLIGHT_CAM_PAN_TILT extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.FLOODLIGHT_CAM_PAN_TILT
    }
}