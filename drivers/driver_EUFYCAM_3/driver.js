const mainDriver = require('../main-driver');



module.exports = class driver_EUFYCAM_3 extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.EUFYCAM_3
    }
}