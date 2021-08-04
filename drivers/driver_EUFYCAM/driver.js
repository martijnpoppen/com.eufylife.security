const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_EUFYCAM extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.EUFYCAM_1
    }
}