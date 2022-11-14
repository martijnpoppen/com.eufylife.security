const { sleep, keyByValue } = require('../utils');
const { PropertyName } = require('../eufy-homey-client');
const { ARM_TYPES } = require('../../constants/capability_types');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
module.exports = class eufyEventsHelper {
    constructor(homey) {
        this.homey = homey;

        this.init();
    }

    async init() {
        try {
            this.homey.app.log('Init eufyEventsHelper');

            this.homey.app.eufyClient.on('device property changed', (device, name, value) => {
                const device_sn = device.getSerial();

                this.homey.app.deviceList.every(async (d) => {
                    if (device_sn === d.HomeyDevice.device_sn) {
                        this.updateDeviceProperties(d, device, name, value);
                        return false;
                    }

                    return true;
                });
            });

            this.homey.app.eufyClient.on('station property changed', (station, name, value) => {
                const station_sn = station.getSerial();
                this.homey.app.deviceList.every(async (d) => {
                    if (station_sn === d.HomeyDevice.device_sn) {
                        this.updateDeviceProperties(d, station, name, value);
                        return false;
                    }

                    return true;
                });
            });

            this.homey.setInterval(() => {
                this.enforceSettings();
            }, 30 * 60 * 1000);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async updateDeviceProperties(homeyDevice, eufyDevice, name, value) {
        this.homey.app.log(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - EufyDevice: ${eufyDevice.getName()} - HomeyDevice: ${homeyDevice.getName()}`);

        if (name === PropertyName.DeviceBattery && homeyDevice.hasCapability('measure_battery')) {
            homeyDevice.setParamStatus('measure_battery', value);
        }

        if (name === PropertyName.DeviceBatteryTemp && homeyDevice.hasCapability('measure_temperature')) {
            homeyDevice.setParamStatus('measure_temperature', value);
        }

        if (name === PropertyName.DeviceEnabled && homeyDevice.hasCapability('onoff')) {
            homeyDevice.setParamStatus('onoff', value);
        }

        if (name === PropertyName.StationGuardMode && homeyDevice.hasCapability('CMD_SET_ARMING')) {
            const armType = keyByValue(ARM_TYPES, parseInt(value));
            homeyDevice.onCapability_CMD_SET_ARMING(armType);
        }

        if (name === PropertyName.DevicePictureUrl && homeyDevice._image) {
            homeyDevice._image.update();
        }
    }

    async enforceSettings() {
        try {
            this.homey.app.deviceList.every(async (d) => {
                const settings = d.getSettings();

                if (this.homey.app.eufyClient && settings.force_switch_mode_notifications && d.EufyStation) {
                    this.homey.app.log(`[Device] ${d.getName()} - enforceSettings - StationNotificationSwitchModeApp`);
                    await this.homey.app.eufyClient.setStationProperty(d.EufyStation.getSerial(), PropertyName.StationNotificationSwitchModeApp, true);

                    this.homey.app.log(`[Device] ${d.getName()} - enforceSettings - StationNotificationSwitchModeKeypad`);
                    await this.homey.app.eufyClient.setStationProperty(d.EufyStation.getSerial(), PropertyName.StationNotificationSwitchModeKeypad, true);
                }

                if (this.homey.app.eufyClient && settings.force_include_thumbnail && d.EufyDevice && d.EufyDevice.hasProperty(PropertyName.DeviceNotificationType)) {
                    this.homey.app.log(`[Device] ${d.getName()} - enforceSettings - DeviceNotificationType`);
                    await this.homey.app.eufyClient.setDeviceProperty(d.EufyDevice.getSerial(), PropertyName.DeviceNotificationType, 2);
                }
            });
        } catch (error) {
            this.homey.app.log(`enforceSettings - error`, error);
        }
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
