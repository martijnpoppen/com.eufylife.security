const Homey = require('homey');
const { HttpService, LocalLookupService, DeviceClientService, CommandType } = require('eufy-node-client');

// ---------------------------------------SETTINGS----------------------------------------------------------
let _devClientService = undefined;
let _httpService = undefined;
const _settingsKey = `${Homey.manifest.id}.settings`;
const settings = Homey.ManagerSettings.get(_settingsKey);
const timers = [1000, 2000, 2500, 3000, 3500, 4000];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function () {
    _devClientService = await initDevClientService();

    Homey.app.action_CMD_DEVS_SWITCH = new Homey.FlowCardAction('action_CMD_DEVS_SWITCH')
    .registerRunListener(onActionCmdDevsSwitch)
    .register()
    .getArgument('devicelist')
    .registerAutocompleteListener(onDeviceListVariableAutocomplete);

    Homey.app.action_CMD_SET_ARMING = new Homey.FlowCardAction('action_CMD_SET_ARMING')
    .registerRunListener(onActionCmdSetArming)
    .register();
}   

// ---------------------------------------ACTION RUN LISTENERS----------------------------------------------------------

async function onActionCmdDevsSwitch(args) {
    try {
        await sendCommand(CommandType.CMD_DEVS_SWITCH, args.CMD_DEVS_SWITCH, 0, 'CMD_DEVS_SWITCH');
        return Promise.resolve(true);
    } catch (e) {
        Homey.app.error(e);
        return Promise.reject(e);
    }
}

async function onActionCmdSetArming(args) {
    try {
        await sendCommand(CommandType.CMD_SET_ARMING, args.CMD_SET_ARMING, null, 'CMD_SET_ARMING');
        
        return Promise.resolve(true);
    } catch (e) {
        Homey.app.error(e);
        return Promise.reject(e);
    }
}

// ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
async function onDeviceListVariableAutocomplete( query, args ) {
    try {
        if(!_httpService) { 
            await initHttpService();
        }
        const devices = await _httpService.listDevices();
        let results = devices.map((r, i) => ({ id: i, name: r.device_name }));
      
        // filter for query
        results = results.filter( result => {
            return result.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
        });

        Homey.app.log('Found devices - ', results);
      
        return Promise.resolve( results );
    } catch(e) {
        Homey.app.log(e);
    }
}

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function initHttpService() {
    try {
        _httpService = new HttpService(settings.USERNAME, settings.PASSWORD);
    } catch (err) {
        Homey.app.error(err);
    }
}

async function initDevClientService() {
    try {
        Homey.app.log('devClientService - Initializing...');

        const lookupService = new LocalLookupService();
        const address = await lookupService.lookup(settings.LOCAL_STATION_IP);

        Homey.app.log('devClientService - Found IP address', address);

        const devClientService = new DeviceClientService(address, settings.P2P_DID, settings.ACTOR_ID);
        await devClientService.connect();

        Homey.app.log('devClientService - Connecting...');
        if(devClientService.isConnected()) {
            Homey.app.log('devClientService - Connected...');
        }
        return devClientService;
    } catch (err) {
        Homey.app.error(err);
    }
}

function sendCommand(a, b, c, id) {
    return new Promise(async (resolve, reject) => {
        if(_devClientService.isConnected()) {
            const timer = timers[Math.floor(Math.random() * timers.length)];
            Homey.app.log('Connected to P2P service - ', timer);

            setTimeout(() => {
                if(c === null) {
                    Homey.app.log(`Sending Command with Int - ${id} : ${b}`);
                    _devClientService.sendCommandWithInt(a, b);
                } else {
                    Homey.app.log(`Sending Command with IntString - ${id} : ${b}`);
                    _devClientService.sendCommandWithIntString(a, b, c);
                }
                resolve(true);
            }, timer);
        } else {
            Homey.app.log('Not connected to P2P service... Retrying...');
            _devClientService = await initDevClientService();
            sendCommand(a, b, c, id);
        }
    });
}

// ---------------------------------------END OF FILE----------------------------------------------------------