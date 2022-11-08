const mainDriver = require('../main-driver');


module.exports = class driver_EUFYCAM_3C extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.EUFYCAM_3C
    }
}