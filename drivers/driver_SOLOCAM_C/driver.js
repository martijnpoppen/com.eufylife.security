const mainDriver = require('../main-driver');



module.exports = class driver_SOLOCAM_C extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.SOLOCAM_C
    }
}