"use strict";

const mainDevice = require('./main-device');
const { ARM_TYPES } = require('../constants/capability_types');
const { PropertyName, CommandType } = require('eufy-security-client');
const { sleep } = require('../lib/utils.js');

module.exports = class mainHub extends mainDevice {
    async onStartup(initial = false, index) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - starting`);

            this.setUnavailable(`${this.getName()} ${this.homey.__('device.init')}`);

            await sleep((index + 1) * 7000);

            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);

            await this.deviceParams(this, true);

            if (initial) {
                const settings = this.getSettings();

                await this.checkCapabilities();

                await this.resetCapabilities();

                await this.check_alarm_arm_mode(settings);
                await this.check_alarm_generic(settings);

                await this.setCapabilitiesListeners();
            } else {
                await this.resetCapabilities();
            }

            await this.setAvailable();

            await this.setSettings({
                LOCAL_STATION_IP: this.EufyStation.getLANIPAddress(),
                STATION_SN: this.EufyStation.getSerial(),
                DEVICE_SN: this.EufyStation.getSerial()
            });

            this._started = true;

            await sleep(20000);
            this.homey.app.log(`[Device] ${this.getName()} - CMD_SET_ARMING => CMD_SET_ARMING`);
            await this.setCapabilityValue('CMD_SET_ARMING', 'disarmed');
        } catch (error) {
            this.setUnavailable(this.homey.__('device.serial_failure_station'));
            this.homey.app.log(error);
        }
    }

    async onCapability_CMD_SET_ARMING(value, triggerByFlow = false) {
        try {
            let CMD_SET_ARMING = ARM_TYPES[value];

            if (typeof CMD_SET_ARMING === 'undefined' || CMD_SET_ARMING === null) {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING => wrong arm type`, CMD_SET_ARMING, value);
                return Promise.resolve(true);
            }

            this.EufyStation.rawStation.member.nick_name = 'Homey';

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING - triggerByFlow`, triggerByFlow);
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING - `, value, CMD_SET_ARMING);
            await this.homey.app.eufyClient.setStationProperty(this.HomeyDevice.station_sn, PropertyName.StationGuardMode, CMD_SET_ARMING);

            await this.set_alarm_arm_mode(value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_RINGTONE_HUB(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_RINGTONE_HUB - `, value);

            this.EufyStation.rawStation.member.nick_name = 'Homey';

            const eufyDevices = await this.homey.app.eufyClient.getDevices();
            this.EufyStationDevice = eufyDevices.find((d) => d.getStationSerial() === this.EufyStation.getSerial() && d.isDoorbell());

            if (!this.EufyStationDevice) {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_RINGTONE_HUB - standalone`);
                throw new Error('Chime without a connected doorbell is not supported anymore');
            } else {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_RINGTONE_HUB - with EufyStationDevice`);
                await this.EufyStation.setHomebaseChimeRingtoneType(this.EufyStationDevice, value);
            }
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_ALARM(seconds) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, seconds);

            this.EufyStation.rawStation.member.nick_name = 'Homey';

            await this.EufyStation.triggerStationAlarmSound(seconds + 2);
            // time + 2 so we can disable alarm manually.

            // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
            await sleep(seconds * 1000);

            await this.EufyStation.triggerStationAlarmSound(0);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, 0);

            this.EufyStation.rawStation.member.nick_name = 'Homey';
            
            await this.EufyStation.resetStationAlarmSound();

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_NTFY_TRIGGER(message, value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => `, message, value);
            const settings = this.getSettings();

            if (this.hasCapability(message)) {
                if (message !== 'alarm_generic') {
                    await this.setCapabilityValue(message, value);

                    if (message === 'CMD_SET_ARMING') {
                        await this.set_alarm_arm_mode(value);
                    }
                }

                if (message === 'alarm_generic' && !!settings.alarm_generic_enabled) {
                    await this.setCapabilityValue(message, value);
                    this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => setMotionAlarm`, value);
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async deviceParams(ctx, initial = false) {
        try {
            // will be called from event helper
            const settings = ctx.getSettings();

            if (settings.force_switch_mode_notifications && ctx.EufyStation) {
                // ctx.homey.app.log(`[Device] ${ctx.getName()} - enforceSettings - StationNotificationSwitchModeApp`, ctx.EufyStation.getSoftwareVersion());

                // await ctx.homey.app.eufyClient.setStationProperty(settings.STATION_SN, PropertyName.StationNotificationSwitchModeApp, true).catch((e) => ctx.log(e));
            }
        } catch (e) {
            ctx.homey.app.error(e);
        }
    }
};
