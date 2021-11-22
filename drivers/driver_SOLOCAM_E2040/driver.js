const mainDriver = require('../main-driver');
const { DEVICE_TYPES } = require('../../../constants/device_types');


module.exports = class driver_SOLOCAM_E2040 extends mainDriver {
    deviceType() {
        return DEVICE_TYPES.SOLOCAM_E2040
    }
}