const Homey = require('homey');
const { CommandType, sleep } = require('eufy-node-client');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");
let _httpService = undefined;

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);
    
        await this.initCameraImage();

        await this.checkCapabilities();

        this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));
        this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));

        if(this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE')) {
            await this.setQuickResponseStore();
            this.registerCapabilityListener('CMD_DOORBELL_QUICK_RESPONSE', this.onCapability_CMD_DOORBELL_QUICK_RESPONSE.bind(this));
        }

        this.setAvailable();

        await this.matchDeviceWithDeviceStore(true);
    }

    async onAdded() {
        const settings = await Homey.app.getSettings();
        await this.initCameraImage();
        await sleep(4500);
        await eufyNotificationCheckHelper.init(settings);
    }

    async checkCapabilities() {
        const driver = this.getDriver();
        const driverManifest = driver.getManifest();
        const driverCapabilities = driverManifest.capabilities;
        
        if(!this.hasCapability('NTFY_PET_DETECTED') || !this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE_POWERED') || !this.hasCapability('CMD_SET_ARMING_HUB')) {
            Homey.app.log(`[Device] ${this.getName()} - FIX - Remove CMD_SET_ARMING - Homebase integration`);
            this.removeCapability('CMD_SET_ARMING');
            await sleep(2500);
        }
        
        const deviceCapabilities = this.getCapabilities();

        Homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);
        
        if(driverCapabilities.length > deviceCapabilities.length) {      
            await this.updateCapabilities(driverCapabilities);
        }

        return;
    }

    async updateCapabilities(driverCapabilities) {
        Homey.app.log(`[Device] ${this.getName()} - Add new capabilities =>`, driverCapabilities);
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
        const settings = this.getSettings();

        try {
            if(!value && settings && settings.override_onoff) {
                throw new Error('Device always-on enabled in settings');
            }

            const deviceId = this.getStoreValue('device_index');
            let CMD_DEVS_SWITCH = value ? 0 : 1;
            if(this.hasCapability('CMD_REVERSE_DEVS_SWITCH')) {
                CMD_DEVS_SWITCH = value ? 1 : 0;
            }

            await eufyCommandSendHelper.sendCommand('CMD_DEVS_SWITCH', deviceObject.station_sn, CommandType.CMD_DEVS_SWITCH, CMD_DEVS_SWITCH, deviceId, deviceId);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
    
    async onCapability_CMD_SET_ARMING( value ) {
        const deviceObject = this.getData();
        try {
            let CMD_SET_ARMING = value;
            
            if(!this.hasCapability('CMD_SET_ARMING_HUB')) {
                if(CMD_SET_ARMING == '6') {
                    throw new Error('Not available for this device');
                }
            }

            await eufyCommandSendHelper.sendCommand('CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, CMD_SET_ARMING);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_START_STOP_STREAM( startStream ) {
        try {
            _httpService = Homey.app.getHttpService();
            const deviceObject = this.getData();

            const requestObject = {
                "device_sn": deviceObject.device_sn, 
                "station_sn": deviceObject.station_sn,
                'proto': 2
            }

            if(startStream) {
                const response = await _httpService.startStream(requestObject);
                const streamStart = response.url ? response.url : null;
                await this.setCapabilityValue( 'CMD_START_STREAM', streamStart);
            } else {
                await _httpService.stopStream(requestObject);
                await this.setCapabilityValue( 'CMD_START_STREAM', 'No stream found');
            }

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_DOORBELL_QUICK_RESPONSE( value ) {
        const deviceObject = this.getData();

        try {
            const quickResponse = this.getStoreValue('quick_response');
            const deviceId = this.getStoreValue('device_index');
            if(quickResponse.length >= value) {
                await eufyCommandSendHelper.sendCommand('CMD_START_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_START_REALTIME_MEDIA, 1, deviceId, deviceId);
                await sleep(500);
                await eufyCommandSendHelper.sendCommand('CMD_DOORBELL_QUICK_RESPONSE', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_QUICK_RESPONSE, quickResponse[value-1], deviceId, deviceId);
                await sleep(3000);
                await eufyCommandSendHelper.sendCommand('CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, 1, deviceId, deviceId);
            }
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            const settings = this.getSettings();
            const setMotionAlarm = message !== 'NTFY_PRESS_DOORBELL' && !!settings.alarm_motion_enabled;
            
            if(this.hasCapability(message)) {
                this.setCapabilityValue(message, true);
                if(setMotionAlarm) this.setCapabilityValue('alarm_motion', true);

                await sleep(5000);

                this.setCapabilityValue(message, false);
                
                if(setMotionAlarm) {
                    await sleep(5000);
                    this.setCapabilityValue('alarm_motion', false);
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    initCameraImage() {
        try {
            Homey.app.log(`[Device] ${this.getName()} - Set initial image`);
            const deviceObject = this.getData();
            this._image = new Homey.Image();
            this._image.setPath('assets/images/large.jpg');
            this._image.register()
                .then(() => this.setCameraImage(deviceObject.station_sn, this.getName(), this._image))
                .catch(this.error);
                
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async matchDeviceWithDeviceStore(initCron = false) {
        // Also set param specific capabilities. Cron this function
        try {
            await sleep(9000);
            const deviceObject = this.getData();
            const deviceStore = Homey.app.getDeviceStore();
            if(deviceStore) {
                const deviceMatch = deviceStore && deviceStore.find(d => d.device_sn === deviceObject.device_sn);
                this.setStoreValue('device_index', deviceMatch.index);

                if(this.hasCapability('measure_battery')) {
                    Homey.app.log('Set measure_battery to: ', )
                    this.setParamStatus(deviceMatch, 'measure_battery');
                }

                if(this.hasCapability('measure_temperature')) {
                    this.setParamStatus(deviceMatch, 'measure_temperature');
                }
            }

            if(initCron) {
                await eufyParameterHelper.registerCronTask(deviceObject.device_sn, "EVERY_TWO_HOURS", this.matchDeviceWithDeviceStore)
            }
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async setQuickResponseStore() {
        try {
            await sleep(7000);
            _httpService = Homey.app.getHttpService();
            const deviceObject = this.getData();

            let quickResponse = await _httpService.voiceList(deviceObject.device_sn);
            Homey.app.log(`[Device] ${this.getName()} - Set quickResponse`, quickResponse);

            quickResponse = quickResponse.map(v => v.voice_id);
            Homey.app.log(`[Device] ${this.getName()} - Mapped quickResponse`, quickResponse);

            if(quickResponse) {
                this.setStoreValue('quick_response', quickResponse);
            }
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async setParamStatus(deviceObject, param) {
        try {
            await this.setCapabilityValue(param, deviceObject[param]);
            Homey.app.log(`[Device] ${this.getName()} - setParamStatus ${param} - to: `, deviceObject[param]);
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
}