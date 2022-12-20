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


            await sleep(25000);
            this.enforceSettings();
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async updateDeviceProperties(HomeyDevice, eufyDevice, name, value) {
        this.homey.app.log(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - EufyDevice: ${eufyDevice.getName()} - HomeyDevice: ${HomeyDevice.getName()} - Value: ${value}`);

        if (name === PropertyName.DeviceBattery && HomeyDevice.hasCapability('measure_battery')) {
            HomeyDevice.setParamStatus('measure_battery', value);
        }

        if (name === PropertyName.DeviceBatteryTemp && HomeyDevice.hasCapability('measure_temperature')) {
            HomeyDevice.setParamStatus('measure_temperature', value);
        }

        if (name === PropertyName.DeviceEnabled && HomeyDevice.hasCapability('onoff')) {
            HomeyDevice.setParamStatus('onoff', value);
        }

        if (name === PropertyName.StationCurrentMode && HomeyDevice.hasCapability('CMD_SET_ARMING')) {
            const armType = keyByValue(ARM_TYPES, parseInt(value));
            HomeyDevice.setParamStatus('CMD_SET_ARMING', armType);
        }

        if (name === PropertyName.DevicePictureUrl && HomeyDevice._image) {
            HomeyDevice._image.update();
        }
    }

    async enforceSettings() {
        try {
            this.homey.app.deviceList.every(async (d) => {
                const settings = d.getSettings();

                if(d._started && this.homey.app.eufyClient) {
                    if (settings.force_switch_mode_notifications && d.EufyStation) {
                        this.homey.app.log(`[Device] ${d.getName()} - enforceSettings - StationNotificationSwitchModeApp`, d.EufyStation.getSoftwareVersion());
                        if(await this.homey.app.eufyClient.getStation('asdf')) {
                            await this.homey.app.eufyClient.setStationProperty(settings.STATION_SN, PropertyName.StationNotificationSwitchModeApp, true);
                        }
                        

                    } else if (settings.force_include_thumbnail && d.EufyDevice && d.EufyDevice.hasProperty(PropertyName.DeviceNotificationType)) {
                        this.homey.app.log(`[Device] ${d.getName()} - enforceSettings - DeviceNotificationType`);
                        if(await this.homey.app.eufyClient.getDevice('asdf')) {
                            await this.homey.app.eufyClient.setDeviceProperty(settings.DEVICE_SN, PropertyName.DeviceNotificationType, 2);
                        }
                    }
                } else {
                    this.homey.app.log(`enforceSettings - device started? `, d._started);
                }

               
            });
        } catch (error) {
            this.homey.app.log(`enforceSettings - error`, error);
        }
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
