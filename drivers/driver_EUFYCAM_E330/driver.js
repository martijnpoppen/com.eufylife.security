const mainDriver = require('../main-driver');


module.exports = class driver_EUFYCAM_E330 extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.EUFYCAM_E330
    }
}