const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_MOTIONSENSOR extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.MOTION_SENSOR
    }
}