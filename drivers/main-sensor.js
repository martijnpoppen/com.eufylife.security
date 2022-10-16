const mainDevice = require('./main-device');

module.exports = class mainSensor extends mainDevice {
    async onStartup() {
        try {
            this.homey.app.log('[Device] - starting =>', this.getName());

            this.EufyDevice = await this.homey.app.eufyClient.getDevice(this.HomeyDevice.device_sn);
            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);
    
            await this.resetCapabilities();
            await this.checkCapabilities();
            await this.setCapabilitiesListeners();
    
            await this.setAvailable();
        } catch (error) {
            this.setUnavailable(error);
            this.homey.app.log(error);
        }
       
    }

    async onCapability_NTFY_TRIGGER(message, value) {
        try {
            if (this.hasCapability(message)) {
                this.setCapabilityValue(message, true);
                await sleep(10000);
                this.setCapabilityValue(message, false);
            }
            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }
};
