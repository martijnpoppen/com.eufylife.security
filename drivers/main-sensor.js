const Homey = require('homey');
const mainDevice = require('../main-device');

const { sleep } = require('eufy-node-client');
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");

module.exports = class mainSensor extends mainDevice {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);

        await this.checkCapabilities();

        this.registerCapabilityListener('alarm_MOTION_DETECTED', this.onCapability_alarm_MOTION_DETECTED.bind(this));

        this.setAvailable();

        await this.findDeviceIndexInStore();
    }

    async onAdded() {
        const settings = await Homey.app.getSettings();
        await eufyNotificationCheckHelper.init(settings);
    }

    async onCapability_alarm_MOTION_DETECTED( value ) {
        try {
            this.setCapabilityValue('alarm_MOTION_DETECTED', value)
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}