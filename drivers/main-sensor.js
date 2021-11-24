const Homey = require('homey');
const mainDevice = require('./main-device');

const { sleep } = require('../lib/eufy-homey-client');
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");

module.exports = class mainSensor extends mainDevice {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());

        this.removeCapability('measure_battery');
        this.removeCapability('measure_temperature');
        await sleep(4000)

        await this.checkCapabilities();

        this.setAvailable();

        await this.matchDeviceWithDeviceStore(this);
    }

    onDeleted() {

    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            if(this.hasCapability(message)) {
                this.setCapabilityValue(message, true);
                await sleep(10000);
                this.setCapabilityValue(message, false);
            }
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}