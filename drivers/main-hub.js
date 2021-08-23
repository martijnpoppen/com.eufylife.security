const Homey = require('homey');
const { CommandType, sleep } = require('../lib/eufy-homey-client');

const mainDevice = require('./main-device');
const EufyP2P = require("../../lib/helpers/eufy-p2p.helper");
const eufyParameterHelper = require("../../lib/helpers/eufy-parameter.helper");

const { ARM_TYPES } = require('../constants/capability_types');

module.exports = class mainHub extends mainDevice {
    async onInit() {
        await this.setupEufyP2P();
        await this.resetCapabilities();
        await this.checkCapabilities();
        await this.setCapabilitiesListeners();

        this.setAvailable();

        await sleep(9000);
        this.checkSettings(this, true);
    }

    async setupEufyP2P() {
		Homey.app.log('[HUB] - init =>', this.getName());
        Homey.app.log('[HUB] - init =>', this.getData());
        
        Homey.app._devices.push(this);

        this.setUnavailable(`Initializing ${this.getName()}`);

        await this.findHubIp();
    }
    

    async onSettings(oldSettings, newSettings, changedKeys) {
        Homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);

        if(this.hasCapability('alarm_generic') && changedKeys.includes('alarm_generic_enabled')) {
          this.resetCapability('alarm_generic');
        }

        this.checkSettings(this, false, newSettings);
    }

    async resetCapabilities() {
        try {
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

    async setCapabilitiesListeners() {
        try {
            this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
        } catch (error) {
            Homey.app.log(error)
        }
    }

    async checkSettings( ctx, initCron = false, overrideSettings = {} ) {
        try {
            const deviceSettings = Object.keys(overrideSettings).length ? overrideSettings : ctx.getSettings();
            const deviceObject = ctx.getData();

            Homey.app.log(`[Device] ${ctx.getName()} - checking deviceSettings`, deviceSettings);
            if(deviceSettings.force_switch_mode_notifications) {
                
                Homey.app.log(`[Device] ${ctx.getName()} - checking settings, found force_switch_mode_notifications`);
                
                const settings = await Homey.app.getSettings();
                const nested_payload = {
                    "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                    "cmd": CommandType.CMD_HUB_NOTIFY_MODE,
                    "mValue3": 0,
                    "payload":{
                        "arm_push_mode": 128,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await Homey.app.EufyP2P.sendCommand('CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);


                const payload_edit = {
                    "payload":{
                        "arm_push_mode": 144,
                        "notify_alarm_delay": 1,
                        "notify_mode": 0
                    }
                }

                await Homey.app.EufyP2P.sendCommand('CMD_HUB_NOTIFY_MODE', deviceObject.station_sn, CommandType.CMD_HUB_NOTIFY_MODE, {...nested_payload, ...payload_edit}, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            }

            if(initCron) {
                await eufyParameterHelper.registerCronTask(deviceObject.device_sn, "EVERY_HALVE_HOURS", this.checkSettings, ctx)
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
            const setMotionAlarm = message === 'alarm_generic' && !!settings.alarm_generic_enabled;

            if(this.hasCapability(message)) {
                if(message !== 'alarm_generic') this.setCapabilityValue(message, value);
                if(setMotionAlarm) {
                    this.setCapabilityValue(message, value);
                }
            }
         
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_ARMING( value ) {
        try {
            let CMD_SET_ARMING = ARM_TYPES[value];
            
            if(typeof CMD_SET_ARMING === 'undefined' || CMD_SET_ARMING === null) {
                Homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING => wrong arm type`, CMD_SET_ARMING, value);
                return Promise.resolve(true);
            }

            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const nested_payload = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_ARMING,
                "mValue3": 0,
                "payload": {
                    "mode_type": CMD_SET_ARMING,
                    "user_name": "Homey"
                }
            }

            await Homey.app.EufyP2P.sendCommand('CMD_SET_ARMING', deviceObject.station_sn, CommandType.CMD_SET_ARMING, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);

            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_TRIGGER_ALARM(time) {
        try {
            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const nested_payload = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": (time + 2),
                    "user_name": "Homey"
                }
            }
            // time + 2 so we can disable alarm manually.

            await Homey.app.EufyP2P.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            
            // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
            await sleep(time * 1000);
            
            const nested_payload_off = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": 0,
                    "user_name": "Homey"
                }
            }
            await Homey.app.EufyP2P.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload_off, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            const deviceObject = this.getData();
            const settings = await Homey.app.getSettings();
            const nested_payload = {
                "account_id": settings.HUBS[deviceObject.station_sn].ACTOR_ID,
                "cmd": CommandType.CMD_SET_TONE_FILE,
                "mValue3": 0,
                "payload": {
                    "time_out": 0,
                    "user_name": "Homey"
                }
            }
            await Homey.app.EufyP2P.sendCommand('CMD_SET_TONE_FILE', deviceObject.station_sn, CommandType.CMD_SET_TONE_FILE, nested_payload, 0, 0, '', CommandType.CMD_SET_PAYLOAD);
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }


    async findHubIp() {
        try {
            let settings = await Homey.app.getSettings();
            const deviceObject = this.getData();
            const stationSN = deviceObject.station_sn.slice(deviceObject.station_sn.length - 4)
            const stationIP = settings.HUBS[deviceObject.station_sn].LOCAL_STATION_IP;
          
            const discoveryStrategy = Homey.ManagerDiscovery.getDiscoveryStrategy("homebase_discovery");
    
            // Use the discovery results that were already found
            const initialDiscoveryResults = discoveryStrategy.getDiscoveryResults();
            for (const discoveryResult of Object.values(initialDiscoveryResults)) {
                Homey.app.log(`[Device] ${this.getName()} - findHomebaseIp =>`, discoveryResult);

                const name = discoveryResult.name.slice(discoveryResult.name.length - 4) || null ;
                const address = discoveryResult.address || null;

                Homey.app.log(`[Device] ${this.getName()} - findHomebaseIp => name match with station SN =>`, name, stationSN);
                Homey.app.log(`[Device] ${this.getName()} - findHomebaseIp => Ip match with settings =>`, stationIP, address); 
              
                if(stationSN === name && stationIP !== address) {
                    Homey.app.log(`[Device] ${this.getName()} - findHomebaseIp => name matches - different IP`);               

                    settings.HUBS[deviceObject.station_sn].LOCAL_STATION_IP = address;

                    await Homey.app.updateSettings(settings, false);
                }
            }
        } catch (error) {
            Homey.app.log(error)
        }
    }
}