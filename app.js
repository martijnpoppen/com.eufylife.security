"use strict";

const Homey = require("homey");
const { PushRegisterService, HttpService, sleep } = require("eufy-node-client");
const flowActions = require("./lib/flow/actions.js");
const flowTriggers = require("./lib/flow/triggers.js");
const eufyCommandSendHelper = require("./lib/helpers/eufy-command-send.helper");
const eufyNotificationCheckHelper = require("./lib/helpers/eufy-notification-check.helper");
const { log } = require("./logger.js");

const ManagerSettings = Homey.ManagerSettings;
const _settingsKey = `${Homey.manifest.id}.settings`;
let _httpService = undefined;
let _devices = [];

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);

    if(this.appSettings && this.appSettings.SET_DEBUG) {
        return log.info.apply(log, arguments)
    }
  }

  error() {
    console.error.bind(this, "[log]").apply(this, arguments);
    if(this.appSettings && this.appSettings.SET_DEBUG) {
        return log.error.apply(log, arguments)
    }
  }

  // -------------------- INIT ----------------------

  async onInit() {
    this.log(`${Homey.manifest.id} started...`);
    await this.initSettings();
    this.log("- Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

    if (this.appSettings.LOCAL_STATION_IP) {
        await eufyCommandSendHelper.init(this.appSettings);
        await flowActions.init();
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
        this.log("Found settings key", _settingsKey);
        this.appSettings = ManagerSettings.get(_settingsKey);

        if (!_httpService) {
            _httpService = await this.setHttpService(this.appSettings);
        }

        return;
      }

      this.log(`Initializing ${_settingsKey} with defaults`);
      this.updateSettings({
        USERNAME: "",
        PASSWORD: "",
        DSK_KEY: "",
        P2P_DID: "",
        ACTOR_ID: "",
        STATION_SN: "",
        LOCAL_STATION_IP: "",
        SET_CREDENTIALS: true,
        SET_DEBUG: false,
        CREDENTIALS: "",
      });
    } catch (err) {
      this.error(err);
    }
  }

  updateSettings(settings) {
    this.log("New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});
    if (!!settings.USERNAME && !!settings.PASSWORD) {
      this.eufyLogin(settings);
    } else {
      _httpService = undefined;
      this.appSettings = settings;
      this.saveSettings();
    }
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
      this.log("New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});
      this.log(`Found username and password. Logging in to Eufy`);

      _httpService = await this.setHttpService(data);

      const hubs = await _httpService.listHubs();
      this.log(`Logged in. Found station`, hubs[0].station_sn);

      settings.P2P_DID = hubs[0].p2p_did;
      settings.ACTOR_ID = hubs[0].member.action_user_id;
      settings.STATION_SN = hubs[0].station_sn;
      settings.LOCAL_STATION_IP = settings.LOCAL_STATION_IP ? settings.LOCAL_STATION_IP : hubs[0].ip_addr;

      const dsk = await _httpService.stationDskKeys(settings.STATION_SN);
      settings.DSK_KEY = dsk.dsk_keys[0].dsk_key;

      const initNotificationCheckHelper = !settings.CREDENTIALS;

      if (!settings.CREDENTIALS && settings.SET_CREDENTIALS) {
        this.log(`Found SET_CREDENTIALS. Registering pushService`);
        const pushService = new PushRegisterService();
        settings.CREDENTIALS = await pushService.createPushCredentials();
      }

      this.appSettings = settings;
      this.saveSettings();
      this.log("- Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

      if (settings.LOCAL_STATION_IP) {
        await eufyCommandSendHelper.init(this.appSettings);
        await flowActions.init();
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
}

module.exports = App;
