const Homey = require('homey');
const { CommandType, sleep } = require('../lib/eufy-homey-client');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("../../lib/helpers/eufy-notification-check.helper");
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");
const utils = require('../../lib/utils.js')
let _httpService = undefined;

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);
        this.setUnavailable(`Initializing ${this.getName()}`);
    
        await this.initCameraImage();

        await this.checkCapabilities();

        this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));
        
        if(this.hasCapability('CMD_SET_ARMING')) {
            this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
        }

        if(this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE')) {
            await this.setQuickResponseStore();
            this.registerCapabilityListener('CMD_DOORBELL_QUICK_RESPONSE', this.onCapability_CMD_DOORBELL_QUICK_RESPONSE.bind(this));
        }

        this.setAvailable();

        await this.matchDeviceWithDeviceStore(this, true);
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
        const deviceCapabilities = this.getCapabilities();

        Homey.app.log(`[Device] ${this.getName()} - checkCapabilities for`, driverManifest.id);
        
        await sleep(2500);
        
        if(!driverCapabilities.includes('CMD_SET_ARMING') && this.hasCapability('CMD_SET_ARMING')) {
            Homey.app.log(`[Device] ${this.getName()} - FIX - Remove CMD_SET_ARMING - Homebase integration`);
            this.removeCapability('CMD_SET_ARMING');
            await sleep(2500);
        }

        if(driverManifest.id === 'driver_FLOODLIGHT_CAMERA') {
            Homey.app.log(`[Device] ${this.getName()} - FIX - Remove all deviceCapabilities - Floodlight integration`);
            deviceCapabilities.forEach(c => {
                this.removeCapability(c);
            });
            await sleep(2000);
        }
        

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
            let CMD_SET_ARMING = parseInt(value);
            
            if(CMD_SET_ARMING == '6') {
                throw new Error('Not available for this device');
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
        try {
            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const quickResponse = this.getStoreValue('quick_response');
            const deviceId = this.getStoreValue('device_index');
            const poweredDoorbell = this.hasCapability("CMD_DOORBELL_QUICK_RESPONSE_POWERED")
            if(!poweredDoorbell && quickResponse.length >= value) {

                await eufyCommandSendHelper.sendCommand('CMD_START_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_START_REALTIME_MEDIA, 1, deviceId, deviceId);
                await sleep(500);
                await eufyCommandSendHelper.sendCommand('CMD_DOORBELL_QUICK_RESPONSE', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_QUICK_RESPONSE, quickResponse[value-1], deviceId, deviceId);
                await sleep(3000);
                await eufyCommandSendHelper.sendCommand('CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, 1, deviceId, deviceId);

            } else if(poweredDoorbell && quickResponse.length >= value) {
                const rsa_key = utils.getNewRSAPrivateKey();
                const encryptkey = rsa_key.exportKey("components-public").n.slice(1).toString("hex")

                let nested_payload = {
                    "commandType": CommandType.CMD_BIND_BROADCAST,
                    "data": {
                        "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                        "encryptkey": encryptkey,
                        "streamtype": 0
                    }
                };

                await eufyCommandSendHelper.sendCommand('CMD_BIND_BROADCAST', deviceObject.station_sn, CommandType.CMD_BIND_BROADCAST, nested_payload, deviceId, deviceId, '', CommandType.CMD_DOORBELL_SET_PAYLOAD);

                await sleep(500);

                nested_payload = {
                    "commandType": CommandType.CMD_STOP_REALTIME_MEDIA,
                    "data": {
                        "voiceID": quickResponse[value-1]
                    }
                };
                await eufyCommandSendHelper.sendCommand('CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, nested_payload, deviceId, deviceId, '', CommandType.CMD_DOORBELL_SET_PAYLOAD);
                
                await sleep(3000);
                await eufyCommandSendHelper.sendCommand('CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, 1, deviceId, deviceId);

            }
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_REBOOT_HUB() {
        try {
            const deviceObject = this.getData();

            await eufyCommandSendHelper.sendCommand('CMD_HUB_REBOOT', deviceObject.station_sn, CommandType.CMD_HUB_REBOOT, 0);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_INDOOR_PAN_TURN() {
        const deviceObject = this.getData();
        const deviceId = this.getStoreValue('device_index');
        const nested_payload = {
            "commandType": CommandType.CMD_INDOOR_PAN_TURN,
            "data": {
                "cmd_type": -1,
                "rotate_type": 0
            }
        };

        await eufyCommandSendHelper.sendCommand('CMD_INDOOR_PAN_TURN', deviceObject.station_sn, CommandType.CMD_INDOOR_PAN_TURN, nested_payload, deviceId, deviceId, '', CommandType.CMD_DOORBELL_SET_PAYLOAD);

    }

    async onCapability_CMD_BAT_DOORBELL_WDR_SWITCH(value) {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            const CMD_BAT_DOORBELL_WDR_SWITCH = parseInt(value);
            await eufyCommandSendHelper.sendCommand('CMD_BAT_DOORBELL_WDR_SWITCH', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_WDR_SWITCH, CMD_BAT_DOORBELL_WDR_SWITCH, deviceId, deviceId);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY(value) {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            const CMD_BAT_DOORBELL_VIDEO_QUALITY = parseInt(value);
            await eufyCommandSendHelper.sendCommand('CMD_BAT_DOORBELL_VIDEO_QUALITY', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_VIDEO_QUALITY, CMD_BAT_DOORBELL_VIDEO_QUALITY, deviceId, deviceId);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_IRCUT_SWITCH(value) {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            const CMD_IRCUT_SWITCH = parseInt(value);
            await eufyCommandSendHelper.sendCommand('CMD_IRCUT_SWITCH', deviceObject.station_sn, CommandType.CMD_IRCUT_SWITCH, CMD_IRCUT_SWITCH, deviceId, deviceId);

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

    async matchDeviceWithDeviceStore(ctx, initCron = false) {
        // Also set param specific capabilities. Cron this function
        try {
            await sleep(9500);
            const deviceObject = ctx.getData();
            const deviceStore = Homey.app.getDeviceStore();
            if(deviceStore && deviceStore.length) {
                const deviceMatch = deviceStore && deviceStore.find(d => d.device_sn === deviceObject.device_sn);
                ctx.setStoreValue('device_index', deviceMatch.index);

                if(ctx.hasCapability('measure_battery')) {
                    ctx.setParamStatus(deviceMatch, 'measure_battery');
                }

                if(ctx.hasCapability('measure_temperature')) {
                    ctx.setParamStatus(deviceMatch, 'measure_temperature');
                }
            }

            if(initCron) {
                await eufyParameterHelper.registerCronTask(deviceObject.device_sn, "EVERY_HALVE_HOURS", this.matchDeviceWithDeviceStore, ctx)
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