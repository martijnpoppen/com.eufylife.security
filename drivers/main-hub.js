const Homey = require('homey');
const { CommandType, sleep } = require('../lib/eufy-homey-client');
const mainDevice = require('./main-device');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");

module.exports = class mainHub extends mainDevice {
    async onInit() {
		Homey.app.log('[HUB] - init =>', this.getName());
        Homey.app.setDevices(this);
        this.setUnavailable(`Initializing ${this.getName()}`);

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
            const valueString = value ? value.toString() : null;
            const settings = this.getSettings();
            const setMotionAlarm = message === 'alarm_generic' && !!settings.alarm_generic_enabled;

            if(this.hasCapability(message)) {
                if(valueString) this.setCapabilityValue(message, valueString);
                if(setMotionAlarm) {
                    this.setCapabilityValue(message, true);
                    await sleep(30000);
                    this.setCapabilityValue(message, false);
                }
            }
         
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_ARMING( value ) {
        try {
            let CMD_SET_ARMING = parseInt(value);
            
            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const nested_payload = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_ARMING,
                "mValue3": 0,
                "payload": {
                    "mode_type": CMD_SET_ARMING,
                    "user_name": "Homey"
                }
            }

            await eufyCommandSendHelper.sendCommand('CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, nested_payload, 0, 0, '', true);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_ALARM(time) {
        try {
            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const nested_payload = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": time,
                    "user_name": "Homey"
                }
            }

            await eufyCommandSendHelper.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', true);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            const deviceObject = this.getData();
            await eufyCommandSendHelper.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, 0, 0);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}