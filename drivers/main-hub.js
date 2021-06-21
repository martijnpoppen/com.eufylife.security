const Homey = require('homey');
const { CommandType, sleep } = require('../lib/eufy-homey-client');
const mainDevice = require('./main-device');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");

module.exports = class mainHub extends mainDevice {
    async onInit() {
		Homey.app.log('[HUB] - init =>', this.getName());
        Homey.app.setDevices(this);
        this.setUnavailable(`Initializing ${this.getName()}`);

        this.removeCapability('CMD_REBOOT_HUB');
        await sleep(2000);

        await this.checkCapabilities();

        this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));

        this.setAvailable();

        await sleep(9000);
        this.checkSettings(this, true);
    }

    async onAdded() {
        const settings = await Homey.app.getSettings();
        await eufyNotificationCheckHelper.init(settings);
    }

    async onSettings(oldSettings, newSettings) {
        Homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);
        this.checkSettings(this, false, newSettings);
    }

    async checkSettings( ctx, initCron = false, overrideSettings = {} ) {
        try {
            const settings = Object.keys(overrideSettings).length ? overrideSettings : ctx.getSettings();
            const deviceObject = ctx.getData();

            Homey.app.log(`[Device] ${ctx.getName()} - checking settings`, settings);
            if(settings.force_switch_mode_notifications) {
                
                Homey.app.log(`[Device] ${ctx.getName()} - checking settings, found force_switch_mode_notifications`);
                
                const settings = await Homey.app.getSettings();
                const nested_payload = {
                    "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                    "cmd": CommandType.CMD_HUB_NOTIFY_MODE,
                    "mValue3": 0,
                    "payload":{
                        "arm_push_mode": 128,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await eufyCommandSendHelper.sendCommand('CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);


                const payload_edit = {
                    "payload":{
                        "arm_push_mode": 144,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await eufyCommandSendHelper.sendCommand('CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, {...nested_payload, ...payload_edit}, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            }

            if(initCron) {
                await eufyParameterHelper.registerCronTask(deviceObject.device_sn, "EVERY_HALVE_HOURS", this.checkSettings, ctx)
            }
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            const valueString = Number.isInteger(value) ? value.toString() : null;
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

            await eufyCommandSendHelper.sendCommand('CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);

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

            await eufyCommandSendHelper.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);

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