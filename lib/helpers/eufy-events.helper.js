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

            await this.enforceSettings(this, true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async updateDeviceProperties(HomeyDevice, eufyDevice, name, value) {
        this.homey.app.log(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - EufyDevice: ${eufyDevice.getName()} - HomeyDevice: ${HomeyDevice.getName()} - Value: ${value}`);

        if (name === PropertyName.DevicePictureUrl && HomeyDevice._image) {
            HomeyDevice._image.update();
        }
    }

    async enforceSettings(ctx, initial = false) {
        await sleep(10 * 60 * 1000);

        this.deviceList.forEach(async (d) => {
            try {
                if (d._started && ctx.homey.app.eufyClient) {
                   await d.deviceParams(ctx);
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
