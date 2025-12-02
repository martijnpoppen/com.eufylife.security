'use strict';

const mainDevice = require('./main-device');
const { sleep } = require('../lib/utils.js');

module.exports = class mainSensor extends mainDevice {
    async onStartup(initial = false, index) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - starting`);

            this.setUnavailable(`${this.getName()} ${this.homey.__('device.init')}`);

            await sleep((index + 1) * 1000);

            this.EufyDevice = await this.homey.app.eufyClient.getDevice(this.HomeyDevice.device_sn);
            this.HomeyDevice.station_sn = await this.EufyDevice.getStationSerial();
            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);

            this.homey.app.setDevice(this);

            if (initial) {
                await this.checkCapabilities();
                await this.resetCapabilities();
                await this.setCapabilitiesListeners();
            } else {
                await this.resetCapabilities();
            }

            await this.setAvailable();

            await this.setSettings({
                LOCAL_STATION_IP: this.EufyStation.getLANIPAddress(),
                STATION_SN: this.EufyStation.getSerial(),
                DEVICE_SN: this.EufyDevice.getSerial()
            });

            this._started = true;
        } catch (error) {
            this.setUnavailable(this.homey.__('device.serial_failure'));
            this.homey.app.log(error);
        }
    }

    async onCapability_NTFY_TRIGGER(message, value) {
        try {
            this.setParamStatus(message, value).catch(this.error);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }
};
