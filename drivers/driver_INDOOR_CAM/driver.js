const mainDriver = require('../main-driver');


module.exports = class driver_INDOOR_CAM extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.INDOOR_CAM
    }
}