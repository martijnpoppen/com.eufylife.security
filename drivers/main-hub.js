const Homey = require('homey');
const mainDevice = require('./main-device');
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");

module.exports = class mainHub extends mainDevice {
    async onInit() {
		Homey.app.log('[HUB] - init =>', this.getName());
        Homey.app.setDevices(this);

        await this.checkCapabilities();

        this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));

        this.setAvailable();
    }

    async onAdded() {
        const settings = await Homey.app.getSettings();
        await eufyNotificationCheckHelper.init(settings);
    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            const valueString = value.toString();
            if(this.hasCapability(message) && this.getCapabilityValue(message) !== valueString) {
                this.setCapabilityValue(message, valueString);
            }
         
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}