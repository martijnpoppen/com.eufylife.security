const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');

module.exports = class driver_EUFYCAM_2C_PRO extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.EUFYCAM_2C_PRO
    }
}