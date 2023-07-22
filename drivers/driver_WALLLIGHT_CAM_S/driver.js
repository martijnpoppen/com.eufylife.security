const mainDriver = require('../main-driver');



module.exports = class driver_WALLLIGHT_CAM_S extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.WALLLIGHT_CAM_S
    }
}