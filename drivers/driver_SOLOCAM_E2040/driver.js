const mainDriver = require('../main-driver');



module.exports = class driver_SOLOCAM_E2040 extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.SOLOCAM_E2040
    }
}