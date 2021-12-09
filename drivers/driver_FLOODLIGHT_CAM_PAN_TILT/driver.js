const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_FLOODLIGHT_CAM_PAN_TILT extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.FLOODLIGHT_CAM_PAN_TILT
    }
}