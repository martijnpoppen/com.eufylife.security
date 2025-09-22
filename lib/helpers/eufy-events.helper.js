'use strict';

const { sleep } = require('../utils');
const { PropertyName } = require('eufy-security-client');
const fs = require('fs');
const path = require('path');

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
                const device_sn = device.rawDevice.device_sn;
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

            await this.enforceSettings(this);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async updateDeviceProperties(HomeyDevice, eufyDevice, name, value) {
        this.homey.app.debug(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - EufyDevice: ${eufyDevice.getName()} - HomeyDevice: ${HomeyDevice.getName()} - Value: ${value}`);

        if ((name === PropertyName.DevicePicture || name === PropertyName.DevicePictureUrl) && HomeyDevice._image['event']) {
            const userDataPath = path.resolve(__dirname, '/userdata/');
            const eventPath = path.join(userDataPath, `${eufyDevice.getSerial()}_event.jpg`);
            const picture = await eufyDevice.getPropertyValue(PropertyName.DevicePicture);

            const buf = Buffer.from(picture.data, "base64");
            await fs.writeFileSync(eventPath, buf);
            
            this.homey.app.log(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - Saved event image:`, eventPath);

            await sleep(300);

            HomeyDevice.saveImage('event');
        }
    }

    async enforceSettings(ctx) {
        await sleep(1 * 60 * 1000);

        ctx.deviceList.forEach(async (d) => {
            try {
                if (d._started && ctx.homey.app.eufyClient) {
                    await d.deviceParams(d, true);
                } else {
                    ctx.homey.app.debug(`enforceSettings - device started? `, d._started);
                }
            } catch (error) {
                ctx.homey.app.debug(`enforceSettings - error`, error);
            }
        });

        ctx.enforceSettings(ctx);
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
