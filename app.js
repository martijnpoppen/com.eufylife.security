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

const ManagerSettings = Homey.ManagerSettings;
const ManagerCloud = Homey.ManagerCloud;
const _settingsKey = `${Homey.manifest.id}.settings`;
let _serverPort = undefined;

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  // -------------------- INIT ----------------------

  async onInit() {
      try {
        this.log(`${Homey.manifest.id} - ${Homey.manifest.version} started...`);

        await this.initSettings();

        this.log("onInit - Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG'});

        if (this._httpService) {
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
      this.EufyP2P = new EufyP2P;
      this.P2P = {};
      this._deviceList = [];
      this._deviceStore = [];

      ManagerSettings.getKeys().forEach((key) => {
        if (key == _settingsKey) {
          settingsInitialized = true;
        }
      });

      if (settingsInitialized) {
        this.log("initSettings - Found settings key", _settingsKey);
        this.appSettings = ManagerSettings.get(_settingsKey);

        if (('USERNAME' in this.appSettings) && !this._httpService) {
            this._httpService = await this.setHttpService(this.appSettings);
        }

        await eufyParameterHelper.unregisterAllTasks();
        await sleep(2000);
        await this.setDeviceStore(this, true);

        return;
      }

      this.log(`Initializing ${_settingsKey} with defaults`);
      this.updateSettings({
        USERNAME: "",
        PASSWORD: "",
        SET_CREDENTIALS: true,
        CREDENTIALS: ""
      });
    } catch (err) {
      this.error(err);
    }
  }

 updateSettings(settings, resetHttpService = true) {
    this.log("updateSettings - New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG', HUBS: 'LOG'});

    if(resetHttpService) {
        this._httpService = undefined;
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
      this.log("eufyLogin - New settings:",  {...settings, 'USERNAME': 'LOG', PASSWORD: 'LOG', HUBS: 'LOG'});
      this.log(`eufyLogin - Found username and password. Logging in to Eufy`);

      this._httpService = await this.setHttpService(data);

      const hubs = await this._httpService.listHubs();
      
      if(hubs.length) {
        this.log(`eufyLogin - Logged in.`);
      }

      const initNotificationCheckHelper = !settings.CREDENTIALS;

      if (!settings.CREDENTIALS && settings.SET_CREDENTIALS) {
        this.log(`eufyLogin - Found SET_CREDENTIALS. Registering pushService`);
        const pushService = new PushRegisterService();
        settings.CREDENTIALS = await pushService.createPushCredentials();
      }

      this.appSettings = settings;
      this.saveSettings();
      this.log("eufyLogin - Loaded settings", {...this.appSettings, 'USERNAME': 'LOG', PASSWORD: 'LOG', HUBS: 'LOG'});

      if (this._httpService) {
        await this.setDeviceStore(this);
        flowActions.init();
        flowConditions.init();
      } 

      if (settings.CREDENTIALS) {
        if(initNotificationCheckHelper) {
            PushClient.init();
            eufyNotificationCheckHelper.init(this.appSettings);
        } 
        
        flowTriggers.init();
      }

      return;
    } catch (err) {
      this.error(err);
      return err;
    }
  }

  // ---------------------------- GETTERS/SETTERS ----------------------------------

  async setHttpService(settings) {
    try {
      return new HttpService(settings.USERNAME, settings.PASSWORD);
    } catch (err) {
      this.error(err);
    }
  }

  getHttpService() {
      return this._httpService;
  }

  async getDevices() {
    return this._deviceList;
  }

  async setDevice(device) {
    this._deviceList = [...this._deviceList, device];
  }

  async removeDevice(device_sn) {
    Homey.app.log("removeDevice", device_sn);

    const filteredList = this._deviceList.filter(dl => {
        const data = dl.getData()
        return data.device_sn !== device_sn
    });

    this._deviceList = filteredList;
  }

  async setDeviceStore(ctx, initCron = false) {
    let devices = await ctx._httpService.listDevices();

    ctx._deviceStore = [];

    if(devices.length) {
        devices = devices.map((r, i) => {
            const measure_battery = eufyParameterHelper.getParamData(r.params, "CMD_GET_BATTERY");
            const measure_temperature = eufyParameterHelper.getParamData(r.params, "CMD_GET_BATTERY_TEMP");

            return {
                name: r.device_name, 
                index: r.device_channel, 
                device_sn: r.device_sn,
                station_sn: r.station_sn,
                deviceId: `${r.device_sn}-${r.device_id}`,  
                measure_battery,
                measure_temperature
            }
        });

        ctx._deviceStore.push(...devices);
    }

    Homey.app.log("setDeviceStore - Setting up DeviceStore", ctx._deviceStore);

    if(initCron) {
        await eufyParameterHelper.registerCronTask("setDeviceStore", "EVERY_HALVE_HOURS", ctx.setDeviceStore, ctx)
    }
    

    return ctx._deviceStore;
  }

  async getStreamAddress() {
    const internalIp = (await ManagerCloud.getLocalAddress()).replace(/:.*/, '');
    this.log(`getStreamAddress - Set internalIp`, internalIp);
    
    return `${internalIp}:${_serverPort}`;
  }
}

module.exports = App;
