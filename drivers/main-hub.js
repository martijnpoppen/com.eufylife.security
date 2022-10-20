const mainDevice = require('./main-device');
const { ARM_TYPES } = require('../constants/capability_types');
const { sleep } = require('../lib/utils.js');
const { PropertyName } = require('eufy-security-client');

module.exports = class mainHub extends mainDevice {
    async onStartup() {
        try {
            this.homey.app.log('[Device] - starting =>', this.getName());

            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);

            await this.resetCapabilities();
            await this.checkCapabilities();
            await this.setCapabilitiesListeners();

            await this.setHubNotificationSettings()

            await this.setAvailable();

            this.homey.setInterval(() => {
                this.setHubNotificationSettings();
            }, (15 * 60 * 1000));
        } catch (error) {
            this.setUnavailable(error);
            this.homey.app.log(error);
        }
    }

    async setHubNotificationSettings() {
        const settings = this.getSettings();
        if(settings.force_switch_mode_notifications) {
            this.homey.app.log(`[Device] ${this.getName()} - setHubNotificationSettings - StationNotificationSwitchModeApp`);
            await this.homey.app.eufyClient.setStationProperty(this.HomeyDevice.station_sn, PropertyName.StationNotificationSwitchModeApp, true);

            this.homey.app.log(`[Device] ${this.getName()} - setHubNotificationSettings - StationNotificationSwitchModeKeypad`);
            await this.homey.app.eufyClient.setStationProperty(this.HomeyDevice.station_sn, PropertyName.StationNotificationSwitchModeKeypad, true);
        }
    }

    async onCapability_CMD_SET_ARMING(value) {
        try {
            let CMD_SET_ARMING = ARM_TYPES[value];

            if (typeof CMD_SET_ARMING === 'undefined' || CMD_SET_ARMING === null) {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING => wrong arm type`, CMD_SET_ARMING, value);
                return Promise.resolve(true);
            }

            this.EufyStation.rawStation.member.nick_name = 'Homey';

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
        this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_RINGTONE_HUB - `, value);
        await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.station_sn, PropertyName.DeviceChimeHomebaseRingtoneType, value);
    }

    async onCapability_NTFY_TRIGGER(message, value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => `, message, value);
            const settings = this.getSettings();

            if (this.hasCapability(message)) {
                if (message !== 'alarm_generic') this.setCapabilityValue(message, value);

                if (message === 'alarm_generic' && !!settings.alarm_generic_enabled) {
                    this.setCapabilityValue(message, value);
                    this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => setMotionAlarm`, value);
                }

                if (message === 'CMD_SET_ARMING') {
                   this.set_alarm_arm_mode(value);
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }
};
