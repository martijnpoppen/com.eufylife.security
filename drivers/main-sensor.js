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
}