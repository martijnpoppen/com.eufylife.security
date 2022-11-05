const mainDriver = require('../main-driver');


module.exports = class driver_OUTDOOR_CAM_PRO extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.OUTDOOR_CAM_PRO
    }
}