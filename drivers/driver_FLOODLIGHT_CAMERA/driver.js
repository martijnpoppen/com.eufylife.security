const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_FLOODLIGHT_CAMERA extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.FLOODLIGHT_CAMERA
    }
}