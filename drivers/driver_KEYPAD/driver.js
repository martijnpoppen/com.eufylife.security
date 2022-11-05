const mainDriver = require('../main-driver');


module.exports = class driver_KEYPAD extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.KEYPAD
    }
}