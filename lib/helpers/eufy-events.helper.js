'use strict';

const { sleep, keyByValue } = require('../utils');
const { PropertyName } = require('eufy-security-client');
const { ARM_TYPES } = require('../../constants/capability_types');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
module.exports = class eufyEventsHelper {
    constructor(homey) {
        this.homey = homey;

        this.setDevices(this.homey.app.deviceList);
        this.init();
    }

    async setDevices(deviceList) {
        this.homey.app.log('[eufyEventsHelper] - Setting new devices');
        this.deviceList = deviceList;
    }

    async init() {
        try {
            this.homey.app.log('[eufyEventsHelper] - Init');

            this.homey.app.eufyClient.on('device property changed', (device, name, value) => {
                const device_sn = device.getSerial();
                const homeyDevice = this.deviceList.find(async (d) => device_sn === d.HomeyDevice.device_sn);
                if (homeyDevice) {
                    this.updateDeviceProperties(homeyDevice, device, name, value);
                }
            });

            this.homey.app.eufyClient.on('station property changed', (station, name, value) => {
                const station_sn = station.getSerial();
                const homeyStation = this.deviceList.find(async (d) => station_sn === d.HomeyDevice.device_sn);
                if (homeyStation) {
                    this.updateDeviceProperties(homeyStation, station, name, value);
                }
            });

            await this.enforceSettings(this, true);
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

        if (name === PropertyName.DevicePictureUrl && HomeyDevice._image) {
            HomeyDevice._image.update();
        }
    }

    async enforceSettings(ctx, initial = false) {
        if (initial) {
            await sleep(10 * 60 * 1000);
        } else {
            await sleep(40 * 60 * 1000);
        }

        this.deviceList.forEach(async (d) => {
            try {
                const settings = d.getSettings();

                if (d._started && ctx.homey.app.eufyClient) {
                    if (settings.force_switch_mode_notifications && d.EufyStation) {
                        ctx.homey.app.log(`[Device] ${d.getName()} - enforceSettings - StationNotificationSwitchModeApp`, d.EufyStation.getSoftwareVersion());
                        if (await ctx.homey.app.eufyClient.getStation(settings.STATION_SN)) {
                            await ctx.homey.app.eufyClient.setStationProperty(settings.STATION_SN, PropertyName.StationNotificationSwitchModeApp, true);
                        }
                    } else if (settings.force_include_thumbnail && d.EufyDevice && d.EufyDevice.hasProperty(PropertyName.DeviceNotificationType)) {
                        ctx.homey.app.log(`[Device] ${d.getName()} - enforceSettings - DeviceNotificationType`);
                        if (await ctx.homey.app.eufyClient.getDevice(settings.DEVICE_SN)) {
                            await ctx.homey.app.eufyClient.setDeviceProperty(settings.DEVICE_SN, PropertyName.DeviceNotificationType, 2);
                        }
                    }
                } else {
                    ctx.homey.app.log(`enforceSettings - device started? `, d._started);
                }
            } catch (error) {
                ctx.homey.app.log(`enforceSettings - error`, error);
            }
        });

        ctx.enforceSettings(ctx);
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
