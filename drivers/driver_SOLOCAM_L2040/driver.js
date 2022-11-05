const mainDriver = require('../main-driver');



module.exports = class driver_SOLOCAM_L2040 extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.SOLOCAM_L2040
    }
}