const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_DOORSENSOR extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.DOOR_SENSOR
    }
}