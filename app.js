"use strict";

const Homey = require("homey");
const { PushRegisterService, HttpService, PushClient, sleep } = require("./lib/eufy-homey-client");

const flowActions = require("./lib/flow/actions.js");
const flowConditions = require("./lib/flow/conditions.js");
const flowTriggers = require("./lib/flow/triggers.js");
const server = require("./server/index.js");

const EufyP2P = require("./lib/helpers/eufy-p2p.helper");
const eufyNotificationCheckHelper = require("./lib/helpers/eufy-notification-check.helper");
const eufyParameterHelper = require("./lib/helpers/eufy-parameter.helper");

const { log } = require("./logger.js");

const ManagerSettings = Homey.ManagerSettings;
const ManagerCloud = Homey.ManagerCloud;
const _settingsKey = `${Homey.manifest.id}.settings`;
let _serverPort = undefined;
let _httpService = undefined;

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);

    if(this.appSettings && this.appSettings.SET_DEBUG) {
        return log.info.apply(log, arguments)
    }
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);

    if(this.appSettings && this.appSettings.SET_DEBUG) {
        return log.info.apply(log, arguments)
    }
  }

  // -------------------- INIT ----------------------

  async onInit() {
      try {
        this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);

        await this.initSettings();

        this.log("onInit - Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

        if (this.appSettings.HUBS_AMOUNT > 0) {
            this.P2P = {};
            await EufyP2P.init(this.appSettings);
            await flowActions.init();
            await flowConditions.init();
        }

        if (this.appSettings.CREDENTIALS) {
            await PushClient.init();
            await eufyNotificationCheckHelper.init(this.appSettings);
            await flowTriggers.init();
        }

        _serverPort = await server.init();
    } catch (error) {
        Homey.app.log(error);      
    }
  }

  // -------------------- SETTINGS ----------------------

  async initSettings() {
    try {
      let settingsInitialized = false;
      ManagerSettings.getKeys().forEach((key) => {
        if (key == _settingsKey) {
          settingsInitialized = true;
        }
      });

      if (settingsInitialized) {
        this.log("initSettings - Found settings key", _settingsKey);
        this.appSettings = ManagerSettings.get(_settingsKey);
        
        if(this.appSettings && !this.appSettings.ADMIN) {
            this.appSettings = {...this.appSettings, SET_DEBUG: false};
            this.saveSettings();
        }

        this.P2P = {};
        this._devices = [];
        this._deviceStore = [];

        if (!_httpService) {
            _httpService = await this.setHttpService(this.appSettings);
        }

        await this.setDeviceStore(this, true);

        await eufyParameterHelper.unregisterAllTasks();

        return;
      }

      this.log(`Initializing ${_settingsKey} with defaults`);
      this.updateSettings({
        USERNAME: "",
        PASSWORD: "",
        HUBS: {},
        HUBS_AMOUNT: 0,
        SET_CREDENTIALS: true,
        SET_DEBUG: false,
        CREDENTIALS: "",
        ADMIN: false
      });
    } catch (err) {
      this.error(err);
    }
  }

 updateSettings(settings, resetHttpService = true) {
    this.log("updateSettings - New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

    if(resetHttpService) {
        _httpService = undefined;
    }

    this.appSettings = settings;
    this.saveSettings();
  }

  saveSettings() {
    if (typeof this.appSettings === "undefined") {
      this.log("Not saving settings; settings empty!");
      return;
    }

    this.log("Saved settings.");
    ManagerSettings.set(_settingsKey, this.appSettings);
  }

  // -------------------- EUFY LOGIN ----------------------

  async eufyLogin(data) {
    try {
      let settings = data;
      this.log("eufyLogin - New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});
      this.log(`eufyLogin - Found username and password. Logging in to Eufy`);

      _httpService = await this.setHttpService(data);

      const hubs = await _httpService.listHubs();
      
      if(!hubs.length) {
        return new Error('No hubs found. Did you share the devices to your Eufy Account?');
      } else {
        this.log(`eufyLogin - Logged in. Found hubs -`, hubs);
      }

      hubs.forEach(hub => {
        const stationSN = hub.station_sn;
        const localStationIp = settings.HUBS[stationSN] && settings.HUBS[stationSN].LOCAL_STATION_IP
        this.log(`eufyLogin - Get station`, stationSN);

        settings.HUBS[stationSN] = {
            HUB_NAME: hub.station_name,
            P2P_DID: hub.p2p_did,
            ACTOR_ID: hub.member.action_user_id,
            STATION_SN: stationSN,
            LOCAL_STATION_IP: localStationIp ? localStationIp : hub.ip_addr
        }
      });

      settings.HUBS_AMOUNT = Object.keys(settings.HUBS).length;

      const initNotificationCheckHelper = !settings.CREDENTIALS;

      if (!settings.CREDENTIALS && settings.SET_CREDENTIALS) {
        this.log(`eufyLogin - Found SET_CREDENTIALS. Registering pushService`);
        const pushService = new PushRegisterService();
        settings.CREDENTIALS = await pushService.createPushCredentials();
      }

      this.appSettings = settings;
      this.saveSettings();
      this.log("eufyLogin - Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

      if (settings.HUBS_AMOUNT  > 0) {
        this.P2P = {};
        await EufyP2P.init(this.appSettings);
        await this.setDeviceStore(this);
        await flowActions.init();
        await flowConditions.init();
      } 

      if (settings.CREDENTIALS) {
        if(initNotificationCheckHelper) {
            await PushClient.init();
            await eufyNotificationCheckHelper.init(this.appSettings);
        } 
        await flowTriggers.init();
      }

      return;
    } catch (err) {
      this.error(err);
      return err;
    }
  }

  // ---------------------------- GETTERS/SETTERS ----------------------------------

  getSettings() {
    return this.appSettings;
  }

  async setHttpService(settings) {
    try {
      return new HttpService(settings.USERNAME, settings.PASSWORD);
    } catch (err) {
      this.error(err);
    }
  }

  getHttpService() {
      return _httpService;
  }

  async setDeviceStore(ctx, initCron = false) {
    let devices = await _httpService.listDevices();

    this._deviceStore = [];

    if(devices.length) {
        Homey.app.log("setDeviceStore - Mapping deviceList", devices);
        devices = devices.map((r, i) => {
            const measure_battery = eufyParameterHelper.getParamData(r.params, "CMD_GET_BATTERY");
            const measure_temperature = eufyParameterHelper.getParamData(r.params, "CMD_GET_BATTERY_TEMP");

            return {
                name: r.device_name, 
                index: r.device_channel, 
                device_sn: r.device_sn,
                deviceId: `${r.device_sn}-${r.device_id}`,  
                measure_battery,
                measure_temperature
            }
        });

        this._deviceStore.push(...devices);
    }

    Homey.app.log("setDeviceStore - Setting up DeviceStore", this._deviceStore);

    if(initCron) {
        await eufyParameterHelper.registerCronTask("setDeviceStore", "EVERY_HALVE_HOURS", this.setDeviceStore, ctx)
    }
    

    return this._deviceStore;
  }

  async getStreamAddress() {
    const internalIp = (await ManagerCloud.getLocalAddress()).replace(/:.*/, '');
    this.log(`getStreamAddress - Set internalIp`, internalIp);
    
    return `${internalIp}:${_serverPort}`;
  }
}

module.exports = App;
