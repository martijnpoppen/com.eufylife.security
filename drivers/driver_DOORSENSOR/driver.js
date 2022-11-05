const mainDriver = require('../main-driver');


module.exports = class driver_DOORSENSOR extends mainDriver {
    deviceType() {
        return this.homey.app.deviceTypes.DOOR_SENSOR
    }
}