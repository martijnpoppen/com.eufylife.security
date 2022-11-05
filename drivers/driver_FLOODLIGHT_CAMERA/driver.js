const mainDriver = require('../main-driver');


module.exports = class driver_FLOODLIGHT_CAMERA extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.FLOODLIGHT_CAMERA
    }
}