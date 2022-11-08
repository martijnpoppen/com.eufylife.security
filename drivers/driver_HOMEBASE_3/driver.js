const mainHubDriver = require('../main-hub-driver');


module.exports = class driver_HOMEBASE_3 extends mainHubDriver {
    deviceType() {
        return this.homey.app.deviceTypes.HOMEBASE_3
    }
}