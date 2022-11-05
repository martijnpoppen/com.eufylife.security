const mainHubDriver = require('../main-hub-driver');


module.exports = class driver_HOMEBASE_CHIME extends mainHubDriver {
    deviceType() {
        return this.homey.app.deviceTypes.HOMEBASE_CHIME
    }
}