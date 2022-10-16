const mainDriver = require('../main-driver');


module.exports = class driver_MOTIONSENSOR extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.MOTION_SENSOR
    }
}