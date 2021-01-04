"use strict";

const Homey = require("homey");
const { PushRegisterService, HttpService, sleep } = require('eufy-node-client');
const flowTriggers = require('./lib/flow/triggers.js');
const flowActions = require('./lib/flow/actions.js');

const _settingsKey = `${Homey.manifest.id}.settings`;
const _settings = Homey.ManagerSettings;
let _httpService = undefined;

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  async onInit() {
    this.log(`${Homey.manifest.id} started...`);
    await this.initSettings();
    this.log("- Loaded settings", this.appSettings);

    if (this.appSettings.LOCAL_STATION_IP) {
      flowActions.init(this.appSettings, _httpService);
    }

    if (this.appSettings.CREDENTIALS) {
      flowTriggers.init(this.appSettings, _httpService);
    }
  }

  async initSettings() {
    try {
    let settingsInitialized = false;
      _settings.getKeys().forEach((key) => {
      if (key == _settingsKey) {
        settingsInitialized = true;
      }
    });

    if (settingsInitialized) {
      this.log("Found settings key", _settingsKey);
        this.appSettings = _settings.get(_settingsKey);
        if (!_httpService) {
          await this.initHttpService(this.appSettings);
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
      SET_CREDENTIALS: "0",
      CREDENTIALS: ""
    });
  }

  async updateSettings(settings) {
    this.log("New settings:", settings);
    if(!!settings.USERNAME && !!settings.PASSWORD) {
        this.eufyLogin(settings);
    } else {
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
    Settings.set(_settingsKey, this.appSettings);
  }

  async initHttpService(settings) {
    try {
      _httpService = new HttpService(settings.USERNAME, settings.PASSWORD);
    } catch (err) {
      this.error(err);
    }
  }
  async eufyLogin(data) {
    try {
    let settings = data;

    this.log(`Found username and password. Logging in to Eufy`);

      if (!_httpService) {
        await this.initHttpService(data);
      }

      const hubs = await _httpService.listHubs();
    this.log(`Logged in. Found station`, hubs[0].station_sn);

    settings.P2P_DID = hubs[0].p2p_did;
    settings.ACTOR_ID = hubs[0].member.action_user_id;
    settings.STATION_SN = hubs[0].station_sn;
    settings.LOCAL_STATION_IP = hubs[0].ip_addr;

      const dsk = await _httpService.stationDskKeys(settings.STATION_SN);
    settings.DSK_KEY = dsk.dsk_keys[0].dsk_key;      

    if(!settings.CREDENTIALS && settings.SET_CREDENTIALS !== '0') {
        this.log(`Found Credentials. Registering pushService`);
        const pushService = new PushRegisterService();
        settings.CREDENTIALS = await pushService.createPushCredentials();
        await sleep(5 * 1000);

        const fcmToken =  settings.CREDENTIALS.gcmResponse.token;
        await httpService.registerPushToken(fcmToken);
        this.log('Registered at pushService with:', fcmToken);
    }

    this.appSettings = settings;
    this.saveSettings();
    this.log("- Loaded settings", this.appSettings);

      if (settings.LOCAL_STATION_IP) {
        flowActions.init(this.appSettings, _httpService);
    }

      if (settings.CREDENTIALS) {
        flowTriggers.init(this.appSettings, _httpService);
    }

    return;
    } catch (err) {
      this.error(err);
  }
}
}

module.exports = App;
