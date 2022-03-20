const Homey = require('homey');
const fetch = require('node-fetch');

const { CommandType, sleep } = require('../lib/eufy-homey-client');
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");
const utils = require('../../lib/utils.js');
const { ARM_TYPES } = require('../constants/capability_types');

let _httpService = undefined;

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        await this.findHubIp();
        await this.updateHubSettings();
        await this.setupEufyP2P();
        await this.deviceImage();
        await this.resetCapabilities();
        await this.checkCapabilities();
        await this.setCapabilitiesListeners();

        await this.setAvailable();

        await this.matchDeviceWithDeviceStore(this, true);       

        await this.checkHomebaseConnected();
    }

    onDeleted() {
        const deviceObject = this.getData();
        eufyParameterHelper.unregisterTask(deviceObject.device_sn);
        Homey.app.removeDevice(deviceObject.device_sn);
    }

    async updateHubSettings() {
        try {
            // Check for hub settings in app settings. Move to device. (Cloud integration)
            const settings = await this.getSettings();
            const appSettings = Homey.app.appSettings;
            const deviceObject = await this.getData();

            _httpService = Homey.app.getHttpService();

            if(('STATION_SN' in settings) && settings.STATION_SN == "") {
                let hubSettings = appSettings.HUBS && appSettings.HUBS[deviceObject.station_sn];
                
                Homey.app.log(`[Device] ${this.getName()} - updateHubSettings =>`, hubSettings);

                if(hubSettings) {
                    await this.setSettings(hubSettings);
                } else {
                    await this.renewSettings();
                }
            }

            if(('DSK_KEY' in settings) && settings.DSK_KEY == "") {
                await this.renewDSKKey(this);
            }
        } catch (error) {
            Homey.app.error(error)
        }
    }


    async onSettings(oldSettings, newSettings, changedKeys) {
        Homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);

        if(changedKeys.includes('RESET_DATA') && newSettings.RESET_DATA) {
            this.renewSettings(true);
        }   
    }

    async renewSettings(wait = false) {
        try {
            const deviceObject = await this.getData();
            const deviceList = await _httpService.listDevices();
            const device = deviceList.find(d => d.station_sn === deviceObject.station_sn);
            const hub = device.station_conn;

            const settings = {
                HUB_NAME: hub.station_name,
                P2P_DID: hub.p2p_did,
                ACTOR_ID: device.member.admin_user_id,
                STATION_SN: device.station_sn,
                RESET_DATA: false
            }

            Homey.app.log(`[Device] ${this.getName()} - renewSettings =>`, settings);

            if(wait) {
                await sleep(2000);
            }
            
            await this.setSettings(settings);
        } catch (error) {
            Homey.app.error(error)
        }
    }

    async renewDSKKey(ctx) {
        try {
            const settings = ctx.getSettings();
            const deviceObject = await this.getData();

            Homey.app.log(`[Device] ${ctx.getName()} - check for renewDskKey`);

            if (('DSK_KEY' in settings) && (settings.DSK_KEY === "" || !('DSK_EXPIRATION' in settings) || (settings.DSK_EXPIRATION && (new Date()).getTime() >= new Date(settings.DSK_EXPIRATION).getTime()))) {
                Homey.app.log(`[Device] ${ctx.getName()} - renewDskKey - expired`);
                const dsk = await _httpService.stationDskKeys(deviceObject.station_sn);
                Homey.app.log(`[Device] ${ctx.getName()} - renewDskKey`,  dsk);
            
                await ctx.setSettings({DSK_EXPIRATION: dsk.dsk_keys[0].expiration * 1000 })
                await ctx.setSettings({DSK_KEY: dsk.dsk_keys[0].dsk_key});

                const newSettings = ctx.getSettings();
                Homey.app.EufyP2P.setHubData(newSettings);
            }
        } catch (error) {
            Homey.app.error(error)
        }
    }

    async setupEufyP2P() {
        const settings = this.getSettings();

		Homey.app.log('[Device] - init =>', this.getName());

        this.setUnavailable(`Initializing ${this.getName()}`);

        if(('STATION_SN' in settings)) {
            await Homey.app.EufyP2P.init(this, settings);
        }

        await sleep(2000);
        await Homey.app.setDevice(this);
    }

    async checkHomebaseConnected() {
        const deviceObject = await this.getData();
        const settings = await this.getSettings();

        try {
            if(!('STATION_SN' in settings)) {
                await sleep(5000);

                const pairedAppDevices = await Homey.app.getDevices();

                const homebasePaired = pairedAppDevices.some((device) => {
                    const data = device.getData();
                    return deviceObject.station_sn === data.station_sn
                });

                if(!homebasePaired) {
                    Homey.app.log(`[Device] ${this.getName()} - checkHomebaseConnected - hub not found in data`, deviceObject);
                    this.setUnavailable(`Please connect Homebase with station_sn ${deviceObject.station_sn} to your Homey. Restart the app after that.`);
                } else {
                    Homey.app.log(`[Device] ${this.getName()} - checkHomebaseConnected - connected`);
                }
            }
        } catch (error) {
            Homey.app.log(error)
        }
    }

    async resetCapabilities() {
        try {
            if(this.hasCapability('alarm_motion')) {
                this.resetCapability('alarm_motion');
            }

            if(this.hasCapability('alarm_contact')) {
                this.resetCapability('alarm_contact');
            }

            if(this.hasCapability('alarm_generic')) {
                this.resetCapability('alarm_generic');
            }
        } catch (error) {
            Homey.app.log(error)
        }
    }

    async resetCapability(name, value = false) {
        this.setCapabilityValue(name, value);
    }

    async checkCapabilities() {
        const driver = this.getDriver();
        const driverManifest = driver.getManifest();
        const driverCapabilities = driverManifest.capabilities;
        const deviceCapabilities = this.getCapabilities();

        Homey.app.log(`[Device] ${this.getName()} - checkCapabilities for`, driverManifest.id);
        Homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);

        if(driver.id === 'driver_VIDEO_DOORBELL_1080P_POWERED' || driver.id === 'driver_VIDEO_DOORBELL_2K_POWERED') {
            await this.removeCapability('CMD_SET_SNOOZE_MODE');
            await sleep(1000);
        }

        if(driver.id === 'driver_EUFYCAM_2C_PRO') {
            await this.removeCapability('CMD_TRIGGER_ALARM');
            await this.removeCapability('CMD_SET_HUB_ALARM_CLOSE');
            await sleep(1000);
        }
        
        if(driverCapabilities.length !== deviceCapabilities.length) {      
            await this.updateCapabilities(driverCapabilities);
        }

        return;
    }


    async updateCapabilities(driverCapabilities) {
        Homey.app.log(`[Device] ${this.getName()} - Add new capabilities =>`, driverCapabilities);
        try {
            driverCapabilities.forEach(c => {
                if(!this.hasCapability(c)) {
                    this.addCapability(c);
                }
            });
            await sleep(2000);
        } catch (error) {
            Homey.app.log(error)
        }
    }

    async setCapabilitiesListeners() {
        try {
            this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));
            
            if(this.hasCapability('CMD_SET_ARMING')) {
                this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
            }

            if(this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE')) {
                await this.setQuickResponseStore();
                this.registerCapabilityListener('CMD_DOORBELL_QUICK_RESPONSE', this.onCapability_CMD_DOORBELL_QUICK_RESPONSE.bind(this));
            }

            if(this.hasCapability('CMD_SET_FLOODLIGHT_MANUAL_SWITCH')) {
                this.registerCapabilityListener('CMD_SET_FLOODLIGHT_MANUAL_SWITCH', this.onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH.bind(this));
            }
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

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_DEVS_SWITCH', deviceObject.station_sn, CommandType.CMD_DEVS_SWITCH, CMD_DEVS_SWITCH, deviceId, deviceId);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
    
    async onCapability_CMD_SET_ARMING( value ) {
        const deviceObject = this.getData();

        try {
            let CMD_SET_ARMING = ARM_TYPES[value];
            
            if(CMD_SET_ARMING == '6') {
                throw new Error('Not available for this device');
            }

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, CMD_SET_ARMING);

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

            Homey.app.log(`[Device] ${this.getName()} - startStream - `, startStream);

            if(startStream || startStream === '') {
                const localAddress = await Homey.app.getStreamAddress();

                const response = await _httpService.startStream(requestObject);
                
                let streamStart = response.url ? response.url : null;

                if(streamStart && startStream.includes('hls')) {
                    Homey.app.log(`[Device] ${this.getName()} - startStream - hls`, streamStart);

                    streamStart = streamStart.replace('rtmp', 'http');
                    streamStart = streamStart.split('?');

                    const streamUrl = streamStart[0];
                    let formattedParams = streamStart[1].replace('?', '@');
                    formattedParams = streamStart[1].replace('&', '$');

                    streamStart = `http://${localAddress}/stream/?hls=${streamUrl}.m3u8&${formattedParams}`;
                }

                Homey.app.log(`[Device] ${this.getName()} - startStream - hls/rtmp`, streamStart);
                
                await this.setCapabilityValue( 'CMD_START_STREAM', streamStart);
            } else {
                await this.setCapabilityValue( 'CMD_START_STREAM', 'No stream found');
                await _httpService.stopStream(requestObject);
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
            const settings = this.getSettings()
            const quickResponse = this.getStoreValue('quick_response');
            const deviceId = this.getStoreValue('device_index');
            const poweredDoorbell = this.hasCapability("CMD_DOORBELL_QUICK_RESPONSE_POWERED")
            if(!poweredDoorbell && quickResponse.length >= value) {

                await Homey.app.EufyP2P.sendCommand(this, 'CMD_START_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_START_REALTIME_MEDIA, 1, deviceId, deviceId);
                await sleep(500);
                await Homey.app.EufyP2P.sendCommand(this, 'CMD_DOORBELL_QUICK_RESPONSE', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_QUICK_RESPONSE, quickResponse[value-1], deviceId, deviceId);
                await sleep(3000);
                await Homey.app.EufyP2P.sendCommand(this, 'CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, 1, deviceId, deviceId);

            } else if(poweredDoorbell && quickResponse.length >= value) {
                const rsa_key = utils.getNewRSAPrivateKey();
                const encryptkey = rsa_key.exportKey("components-public").n.slice(1).toString("hex")
                let actorID = settings.ACTOR_ID
                
                if(!actorID) {
                    actorID = await Homey.app.EufyP2P.getActorID(deviceObject.station_sn);
                }

                let nested_payload = {
                    "commandType": CommandType.CMD_BIND_BROADCAST,
                    "data": {
                        "account_id": actorID,
                        "encryptkey": encryptkey,
                        "streamtype": 0
                    }
                };

                await Homey.app.EufyP2P.sendCommand(this, 'CMD_BIND_BROADCAST', deviceObject.station_sn, CommandType.CMD_BIND_BROADCAST, nested_payload, deviceId, deviceId, '', CommandType.CMD_DOORBELL_SET_PAYLOAD);

                await sleep(500);

                nested_payload = {
                    "commandType": CommandType.CMD_STOP_REALTIME_MEDIA,
                    "data": {
                        "voiceID": quickResponse[value-1]
                    }
                };
                await Homey.app.EufyP2P.sendCommand(this, 'CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, nested_payload, deviceId, deviceId, '', CommandType.CMD_DOORBELL_SET_PAYLOAD);
                
                await sleep(3000);
                await Homey.app.EufyP2P.sendCommand(this, 'CMD_STOP_REALTIME_MEDIA', deviceObject.station_sn, CommandType.CMD_STOP_REALTIME_MEDIA, 1, deviceId, deviceId);

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

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_HUB_REBOOT', deviceObject.station_sn, CommandType.CMD_HUB_REBOOT, 0);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_INDOOR_PAN_TURN(value = "360", repeat = 1) {
        const deviceObject = this.getData();
        const deviceId = this.getStoreValue('device_index');
        const settings = this.getSettings();
        let actorID = settings.ACTOR_ID
                
        if(!actorID) {
            actorID = await Homey.app.EufyP2P.getActorID(deviceObject.station_sn);
        }

        const obj = {
            "360": {
                "cmd_type": -1,
                "rotate_type": 0
            },
            "up": {
                "cmd_type": 1,
                "rotate_type": 3
            },
            "left": {
                "cmd_type": 1,
                "rotate_type": 1
            },
            "down": {
                "cmd_type": 1,
                "rotate_type": 4
            },
            "right": {
                "cmd_type": 1,
                "rotate_type": 2
            }
        }

        let command = CommandType.CMD_DOORBELL_SET_PAYLOAD;
        let nested_payload = {
            "commandType": CommandType.CMD_INDOOR_PAN_TURN,
            "data": obj[value]
        };

        if(this.hasCapability('CMD_SET_FLOODLIGHT_MANUAL_SWITCH')) {
            nested_payload = {
                "account_id": actorID,
                "cmd": CommandType.CMD_INDOOR_PAN_TURN,
                "mChannel": deviceId,
                "mValue3": 0,
                "payload": obj[value]
            }

            command = CommandType.CMD_SET_PAYLOAD
        }

        for(let i = 0; i < repeat; i++) {
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_INDOOR_PAN_TURN', deviceObject.station_sn, CommandType.CMD_INDOOR_PAN_TURN, nested_payload, deviceId, deviceId, '', command);
        }

    }

    async onCapability_CMD_BAT_DOORBELL_WDR_SWITCH(value) {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            const CMD_BAT_DOORBELL_WDR_SWITCH = parseInt(value);
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_BAT_DOORBELL_WDR_SWITCH', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_WDR_SWITCH, CMD_BAT_DOORBELL_WDR_SWITCH, deviceId, deviceId);

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
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_BAT_DOORBELL_VIDEO_QUALITY', deviceObject.station_sn, CommandType.CMD_BAT_DOORBELL_VIDEO_QUALITY, CMD_BAT_DOORBELL_VIDEO_QUALITY, deviceId, deviceId);

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
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_IRCUT_SWITCH', deviceObject.station_sn, CommandType.CMD_IRCUT_SWITCH, CMD_IRCUT_SWITCH, deviceId, deviceId);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_SNOOZE_MODE(homebase = 0, motion = 0, snooze = 0, chime = 0) {
        const deviceObject = this.getData();
        const deviceId = this.getStoreValue('device_index');
        const settings = this.getSettings(); 
        let actorID = settings.ACTOR_ID
                
        if(!actorID) {
            actorID = await Homey.app.EufyP2P.getActorID(deviceObject.station_sn);
        }
        
        const nested_payload = {
            "account_id": actorID,
            "chime_onoff": parseInt(chime),
            "homebase_onoff": parseInt(homebase),
            "motion_notify_onoff": parseInt(motion),
            "snooze_time": parseInt(snooze),
            "startTime": Math.floor(new Date().getTime() / 1000)

        };

        await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_SNOOZE_MODE', deviceObject.station_sn, CommandType.CMD_SET_SNOOZE_MODE, nested_payload, deviceId, deviceId, '', CommandType.CMD_SET_SNOOZE_MODE);

    }


    async onCapability_CMD_TRIGGER_ALARM(time) {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, time, deviceId, deviceId);
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');

            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, 0, deviceId, deviceId);
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH(value) {    
        try {
            const deviceObject = this.getData();
            const deviceId = this.getStoreValue('device_index');
            await Homey.app.EufyP2P.sendCommand(this, 'CMD_SET_FLOODLIGHT_MANUAL_SWITCH', deviceObject.station_sn, CommandType.CMD_SET_FLOODLIGHT_MANUAL_SWITCH, value, deviceId, deviceId);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_NTFY_TRIGGER( message, value ) {
        try {
            Homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => `, message, value);
            const isNormalEvent = message !== 'CMD_SET_ARMING';
            const settings = this.getSettings();
            const setMotionAlarm = message !== 'NTFY_PRESS_DOORBELL' && !!settings.alarm_motion_enabled;
            
            Homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => isNormalEvent - setMotionAlarm`, isNormalEvent, setMotionAlarm);

            if(this.hasCapability(message)) {
                if(isNormalEvent) {
                    this.setCapabilityValue(message, true);

                    if(setMotionAlarm) {
                        this.setCapabilityValue('alarm_motion', true);
                    }
                } else {
                    this.setCapabilityValue(message, value);
                }                

                await sleep(5000);

                if(isNormalEvent) {
                    this.setCapabilityValue(message, false);
                
                    if(setMotionAlarm) {
                        await sleep(5000);
                        this.setCapabilityValue('alarm_motion', false);
                    }
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async deviceImage(imagePath = "assets/images/large.jpg") {
        try {
            const deviceObject = this.getData();
            Homey.app.log(`[Device] ${this.getName()} - Set image - `, imagePath, this._image);


            if(imagePath !== "assets/images/large.jpg") {
                await this._image.setStream(async (stream) => {
                    const res = await fetch(imagePath);
                    if(!res.ok)
                      throw new Error('Invalid Response');
                  
                    return res.body.pipe(stream);
                });

                Homey.app.log(`[Device] ${this.getName()} - Update image`);

                await this._image.update();
            } else {
                Homey.app.log(`[Device] ${this.getName()} - Set initial image`);

                this._image = new Homey.Image();
                this._image.setPath(imagePath);
                this._image.register()
                    .then(() => this.setCameraImage(deviceObject.station_sn, this.getName(), this._image))
                    .catch(this.error);

                await sleep(4500);
            }

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
            const deviceStore = Homey.app._deviceStore;

            Homey.app.log(`[Device] ${ctx.getName()} - getDeviceStore - retrieving DeviceStore`, deviceStore);

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
        }
    }

    async setQuickResponseStore() {
        try {
            await sleep(7000);
            _httpService = Homey.app.getHttpService();
            const deviceObject = this.getData();

            let quickResponse = await _httpService.voiceList(deviceObject.device_sn);
            Homey.app.log(`[Device] ${this.getName()} - Set quickResponse`);

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

    async findHubIp() {
        try {
            const settings = this.getSettings();

            if(('STATION_SN' in settings)) {
                const stationSN = settings.STATION_SN.slice(settings.STATION_SN.length - 4)
                const stationIP = settings.LOCAL_STATION_IP;
            
                const discoveryStrategy = Homey.ManagerDiscovery.getDiscoveryStrategy("homebase_discovery");
        
                // Use the discovery results that were already found
                const initialDiscoveryResults = discoveryStrategy.getDiscoveryResults();
                for (const discoveryResult of Object.values(initialDiscoveryResults)) {
                    const name = discoveryResult.name.slice(discoveryResult.name.length - 4) || null ;
                    const address = discoveryResult.address || null;

                    Homey.app.log(`[Device] ${this.getName()} - findHubIp => Ip/name match with station =>`, name, stationSN, ' => ', stationIP, address);
                
                    if(stationSN === name && (stationIP !== address || address === '')) {
                        Homey.app.log(`[Device] ${this.getName()} - findHubIp => name matches - set new IP`, address);               

                        await this.setSettings({'LOCAL_STATION_IP': address});;
                    }
                }
            }
        } catch (error) {
            Homey.app.log(error)
        }
    }
}