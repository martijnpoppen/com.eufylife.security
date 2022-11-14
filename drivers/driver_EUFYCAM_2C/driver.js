const mainDriver = require('../main-driver');


module.exports = class driver_EUFYCAM_2C extends mainDriver {
    deviceType() {
        return [...this.homey.app.deviceTypes.EUFYCAM_2C, ...this.homey.app.deviceTypes.EUFYCAM_2C_PRO]
    }
}