"use strict";

const Homey = require("homey");
const { HttpService } = require("eufy-node-client");
const flowTriggers = require('./lib/flow/triggers.js');
const flowActions = require('./lib/flow/actions.js');

const _settingsKey = `${Homey.manifest.id}.settings`;
const Settings = Homey.ManagerSettings;

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  onInit() {
    this.log(`${Homey.manifest.id} started...`);
    this.initSettings();
    this.log("- Loaded settings", this.appSettings);

    if(this.appSettings.LOCAL_STATION_IP) {
        flowActions.init(this.appSettings);
        flowTriggers.init(this.appSettings);
    }
  }

  initSettings() {
    let settingsInitialized = false;
    Settings.getKeys().forEach((key) => {
      if (key == _settingsKey) {
        settingsInitialized = true;
      }
    });

    if (settingsInitialized) {
      this.log("Found settings key", _settingsKey);
      this.appSettings = Settings.get(_settingsKey);
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
    });
  }

  async updateSettings(settings) {
    this.log("New settings:", settings);
    if(!!settings.USERNAME && !!settings.PASSWORD && !settings.P2P_DID) {
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

  async eufyLogin(data) {
    let settings = data;

    this.log(`Found username and password. Logging in to Eufy`);
    const httpService = new HttpService(settings.USERNAME, settings.PASSWORD);

    const hubs = await httpService.listHubs();
    this.log(`Logged in. Found station`, hubs[0].station_sn);

    settings.P2P_DID = hubs[0].p2p_did;
    settings.ACTOR_ID = hubs[0].member.action_user_id;
    settings.STATION_SN = hubs[0].station_sn;
    settings.LOCAL_STATION_IP = hubs[0].ip_addr;

    const dsk = await httpService.stationDskKeys(settings.STATION_SN);
    settings.DSK_KEY = dsk.dsk_keys[0].dsk_key;      

    this.appSettings = settings;
    this.saveSettings();
    this.log("- Loaded settings", this.appSettings);

    if(settings.LOCAL_STATION_IP) {
        flowActions.init(this.appSettings);
    }

    return;
  }
}

module.exports = App;
