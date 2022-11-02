const { sleep, keyByValue } = require('../utils');
const { PropertyName } = require('eufy-security-client');
const { ARM_TYPES } = require('../../constants/capability_types');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
module.exports = class eufyEventsHelper {
    constructor(homey) {
        this.homey = homey;

        this.init();
    }

    async init() {
        try {
            await sleep(20000);

            this.homey.app.log('Init eufyEventsHelper');

            this.homey.app.eufyClient.on('device property changed', (device, name, value) => {
                this.homey.app.deviceList.every(async (homeyDevice) => {
                    const data = homeyDevice.getData();

                    if (device.getSerial() === data.device_sn) {
                        this.updateDeviceProperties(homeyDevice, device, name, value);
                        return false;
                    }

                    return true;
                });
            });

            this.homey.app.eufyClient.on('station property changed', (station, name, value) => {
                this.homey.app.log(`[eufyEventsHelper] - EufyStation: ${station.getName()}`);

                this.homey.app.deviceList.every(async (homeyDevice) => {
                    const data = homeyDevice.getData();

                    if (station.getSerial() === data.device_sn) {
                        this.updateDeviceProperties(homeyDevice, station, name, value);
                        return false;
                    }

                    return true;
                });
            });

            this.enforceSettings();

            this.homey.setInterval(() => {
                this.enforceSettings();
            }, 30 * 60 * 1000);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async updateDeviceProperties(homeyDevice, eufyDevice, name, value) {
        if (homeyDevice) {
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
    }

    async enforceSettings() {
        try {
            this.homey.app.deviceList.every(async (homeyDevice) => {
                const settings = homeyDevice.getSettings();
    
                if (settings.force_switch_mode_notifications && settings.STATION_SN) {
                    this.homey.app.log(`[Device] ${homeyDevice.getName()} - enforceSettings - StationNotificationSwitchModeApp`);
                    await this.homey.app.eufyClient.setStationProperty(settings.STATION_SN, PropertyName.StationNotificationSwitchModeApp, true);
    
                    this.homey.app.log(`[Device] ${homeyDevice.getName()} - enforceSettings - StationNotificationSwitchModeKeypad`);
                    await this.homey.app.eufyClient.setStationProperty(settings.STATION_SN, PropertyName.StationNotificationSwitchModeKeypad, true);
                }
    
                if (settings.force_include_thumbnail && homeyDevice.EufyDevice.hasProperty(PropertyName.DeviceNotificationType) && settings.DEVICE_SN) {
                    this.homey.app.log(`[Device] ${homeyDevice.getName()} - enforceSettings - DeviceNotificationType`);
                    await this.homey.app.eufyClient.setDeviceProperty(settings.DEVICE_SN, PropertyName.DeviceNotificationType, 2);
                }
            });
        } catch (error) {
            this.homey.app.log(`enforceSettings - error`, error);
        }
       
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
