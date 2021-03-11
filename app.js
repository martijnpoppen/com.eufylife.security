"use strict";

const Homey = require("homey");
const { PushRegisterService, HttpService, sleep } = require("eufy-node-client");
const flowActions = require("./lib/flow/actions.js");
const flowConditions = require("./lib/flow/conditions.js");
const flowTriggers = require("./lib/flow/triggers.js");
const eufyCommandSendHelper = require("./lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("./lib/helpers/eufy-notification-check.helper");
const { log } = require("./logger.js");

const ManagerSettings = Homey.ManagerSettings;
const _settingsKey = `${Homey.manifest.id}.settings`;
let _httpService = undefined;
let _deviceStore = undefined;
let _devices = [];

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
    this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);
    await this.initSettings();

    this.log("onInit - Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

    if (this.appSettings.HUBS_AMOUNT > 0) {
        await eufyCommandSendHelper.init(this.appSettings);
        await flowActions.init();
        await flowConditions.init();
    }

    if (this.appSettings.CREDENTIALS) {
        await eufyNotificationCheckHelper.init(this.appSettings);
        await flowTriggers.init();
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
        
        if(this.appSettings && this.appSettings.SET_DEBUG) {
            this.appSettings = {...this.appSettings, SET_DEBUG: false};
            this.saveSettings();
        }

        if (!_httpService) {
            _httpService = await this.setHttpService(this.appSettings);

            if (!_deviceStore) {
                _deviceStore = await this.setDeviceStore();
            }
        }

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
      });
    } catch (err) {
      this.error(err);
    }
  }

updateSettings(settings) {
    this.log("updateSettings - New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});
    _httpService = undefined;
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
        _deviceStore = await this.setDeviceStore(hubs);
        await eufyCommandSendHelper.init(this.appSettings);
        await flowActions.init();
        await flowConditions.init();
      } 

      if (settings.CREDENTIALS) {
        if(initNotificationCheckHelper) {
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

  setDevices(device) {
    _devices.push(device);
  }

  getDevices() {
      return _devices;
  }

  async setDeviceStore(hubs) {
    let hubStore = hubs;
    let deviceStore = [];

    if(!hubStore) {
        hubStore = await _httpService.listHubs();
    }

    hubStore.forEach(hub => {
        if(hub.devices && hub.devices.length) {
            this.log("setDeviceStore - Setting up HubStore", hub.devices);
            let devices = hub.devices.reverse();
            devices = devices.map((r, i) => ({ 
                name: r.device_name, 
                index: i, 
                device_sn: r.device_sn,
                deviceId: `${r.device_sn}-${r.device_id}`  
            }));

            deviceStore.push(...devices);
        }
    });

    this.log("setDeviceStore - Setting up DeviceStore", deviceStore);

    return deviceStore;
  }

  getDeviceStore() {
    this.log("getDeviceStore - retrieving DeviceStore", _deviceStore);
    return _deviceStore;
  }
}

module.exports = App;
