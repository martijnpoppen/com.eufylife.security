const Homey = require('homey');
const { CommandType, sleep } = require('../lib/eufy-homey-client');

const mainDevice = require('./main-device');
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");

const { ARM_TYPES } = require('../constants/capability_types');

module.exports = class mainHub extends mainDevice {
    async onInit() {
        await this.findHubIp();
        await this.updateHubSettings();
        await this.setupEufyP2P();
        await this.resetCapabilities();
        await this.checkCapabilities();
        await this.setCapabilitiesListeners();

        this.setAvailable();

        await sleep(9000);
        this.checkSettings(this, true);
    }

    async onSettings(oldSettings, newSettings, changedKeys) {
        Homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);

        if(this.hasCapability('alarm_generic') && changedKeys.includes('alarm_generic_enabled')) {
          this.resetCapability('alarm_generic');
        }

        if(changedKeys.includes('RESET_DATA')) {
            this.renewSettings(true);
        }

        this.checkSettings(this, false, newSettings);
    }

    async setCapabilitiesListeners() {
        try {
            this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
        } catch (error) {
            Homey.app.log(error)
        }
    }

    async checkSettings(ctx, initCron = false, overrideSettings = {} ) {
        try {
            const deviceSettings = Object.keys(overrideSettings).length ? overrideSettings : ctx.getSettings();
            const deviceObject = ctx.getData();

            Homey.app.log(`[Device] ${ctx.getName()} - checking deviceSettings`, deviceSettings);
            if(deviceSettings.force_switch_mode_notifications) {
                
                Homey.app.log(`[Device] ${ctx.getName()} - checking settings, found force_switch_mode_notifications`);

                const nested_payload = {
                    "account_id": deviceSettings.ACTOR_ID,
                    "cmd": CommandType.CMD_HUB_NOTIFY_MODE,
                    "mValue3": 0,
                    "payload":{
                        "arm_push_mode": 128,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await Homey.app.EufyP2P.sendCommand(ctx, 'CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);


                const payload_edit = {
                    "payload":{
                        "arm_push_mode": 144,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await Homey.app.EufyP2P.sendCommand(ctx, 'CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, {...nested_payload, ...payload_edit}, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            }

            if(initCron) {
                await eufyParameterHelper.registerCronTask(deviceObject.device_sn, "EVERY_HALVE_HOURS", this.checkSettings, ctx)
            }
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
        }
    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            Homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => `, message, value);
            const settings = this.getSettings();
            const setMotionAlarm = message === 'alarm_generic' && !!settings.alarm_generic_enabled;
            Homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => setMotionAlarm`, setMotionAlarm);

            if(this.hasCapability(message)) {
                if(message !== 'alarm_generic') this.setCapabilityValue(message, value);
                if(setMotionAlarm) {
                    this.setCapabilityValue(message, value);
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
            let CMD_SET_ARMING = ARM_TYPES[value];
            
            if(typeof CMD_SET_ARMING === 'undefined' || CMD_SET_ARMING === null) {
                Homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING => wrong arm type`, CMD_SET_ARMING, value);
                return Promise.resolve(true);
            }

            const deviceObject = this.getData();
            const settings = this.getSettings();
            const nested_payload = {
                "account_id": settings.ACTOR_ID,
                "cmd": CommandType.CMD_SET_ARMING,
                "mValue3": 0,
                "payload": {
                    "mode_type": CMD_SET_ARMING,
                    "user_name": "Homey"
                }
            }

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_ALARM(time) {
        try {
            const deviceObject = this.getData();
            const settings = this.getSettings();
            const nested_payload = {
                "account_id": settings.ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": (time + 2),
                    "user_name": "Homey"
                }
            }
            // time + 2 so we can disable alarm manually.

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            
            // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
            await sleep(time * 1000);
            
            const nested_payload_off = {
                "account_id": settings.ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": 0,
                    "user_name": "Homey"
                }
            }
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload_off, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            const deviceObject = this.getData();
            const settings = this.getSettings();
            const nested_payload = {
                "account_id": settings.ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": 0,
                    "user_name": "Homey"
                }
            }
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}