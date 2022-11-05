const mainDriver = require('../main-driver');


module.exports = class driver_EUFYCAM extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.EUFYCAM_1
    }
}