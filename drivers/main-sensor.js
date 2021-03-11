const Homey = require('homey');
const mainDevice = require('./main-device');

const { sleep } = require('eufy-node-client');
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");

module.exports = class mainSensor extends mainDevice {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);

        await this.checkCapabilities();

        this.setAvailable();

        await this.findDeviceIndexInStore();
    }

    async onAdded() {
        const settings = await Homey.app.getSettings();
        await eufyNotificationCheckHelper.init(settings);
    }

    async onCapability_CMD_TRIGGER_MOTION( value ) {
        try {
            this.setCapabilityValue(value, true);
            await sleep(5000);
            this.setCapabilityValue(value, false);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}