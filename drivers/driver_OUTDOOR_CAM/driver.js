const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_OUTDOOR_CAM extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.OUTDOOR_CAM
    }
}