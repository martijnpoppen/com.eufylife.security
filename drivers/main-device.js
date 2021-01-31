const Homey = require('homey');
const { CommandType, sleep } = require('eufy-node-client');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);
    
        await this.checkCapabilities();

        this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));
        this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
        this.registerCapabilityListener('NTFY_MOTION_DETECTION', this.onCapability_CMD_TRIGGER_MOTION.bind(this));

        if(this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE')) {
            this.registerCapabilityListener('CMD_DOORBELL_QUICK_RESPONSE', this.onCapability_CMD_DOORBELL_QUICK_RESPONSE.bind(this));
        }

        await this.initCameraImage();

        this.setAvailable();

        await this.findDeviceIndexInStore();
    }

    async checkCapabilities() {
        // FIX 1.7.2 - capability
        this.removeCapability('CMD_TRIGGER_MOTION');

        const driver = this.getDriver();
        const driverManifest = driver.getManifest();
        const driverCapabilities = driverManifest.capabilities;
        const deviceCapabilities = this.getCapabilities();

        Homey.app.log('[Device] - Found capabilities =>', deviceCapabilities);

        if(driverCapabilities.length > deviceCapabilities.length) {      
            await this.setCapabilities(driverCapabilities);
            return;
        }

        return;
    }

    async setCapabilities(driverCapabilities) {
        Homey.app.log('[Device] - Add new capabilities =>', driverCapabilities);
        try {
            driverCapabilities.forEach(c => {
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            Homey.app.log(error)
        }
    }
    
    async onCapability_CMD_DEVS_SWITCH( value ) {
        const deviceObject = this.getData();
        try {
            const deviceId = this.getStoreValue('device_index');
            let CMD_DEVS_SWITCH = value ? 0 : 1;
            if(this.hasCapability('CMD_REVERSE_DEVS_SWITCH')) {
                CMD_DEVS_SWITCH = value ? 1 : 0;
            }

            await eufyCommandSendHelper.sendCommand(CommandType.CMD_DEVS_SWITCH, CMD_DEVS_SWITCH, deviceId, 'CMD_DEVS_SWITCH', deviceObject.station_sn);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
    
    async onCapability_CMD_SET_ARMING( value ) {
        const deviceObject = this.getData();
        try {
            const CMD_SET_ARMING = value;
            await eufyCommandSendHelper.sendCommand(CommandType.CMD_SET_ARMING, CMD_SET_ARMING, null, 'CMD_SET_ARMING', deviceObject.station_sn);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_DOORBELL_QUICK_RESPONSE( value ) {
        const deviceObject = this.getData();
        try {
            const deviceId = this.getStoreValue('device_index');
            await eufyCommandSendHelper.sendCommand(CommandType.CMD_BAT_DOORBELL_QUICK_RESPONSE, value, deviceId, 'CMD_DOORBELL_QUICK_RESPONSE', deviceObject.station_sn);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_MOTION( value ) {
        try {
            this.setCapabilityValue(value, true)
            await sleep(5000);
            this.setCapabilityValue(value, false)
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    initCameraImage() {
        Homey.app.log('[Device] - Set initial image');
        const deviceObject = this.getData();
        this._image = new Homey.Image();
        this._image.setPath('assets/images/large.jpg');
        this._image.register()
            .then(() => this.setCameraImage(deviceObject.station_sn, this.getName(), this._image))
            .catch(this.error);
    }

    async findDeviceIndexInStore() {
        try {
            await sleep(9000);
            const deviceObject = this.getData();
            const deviceStore = Homey.app.getDeviceStore();
            if(deviceStore) {
                const deviceMatch = deviceStore && deviceStore.find(d => d.device_sn === deviceObject.device_sn);
                this.setStoreValue('device_index', deviceMatch.index);
            }
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}