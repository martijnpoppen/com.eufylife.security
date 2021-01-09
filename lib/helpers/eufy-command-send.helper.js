const Homey = require('homey');
const { LocalLookupService, DeviceClientService } = require('eufy-node-client');

// --------------------------------------- SETTINGS ----------------------------------------------------------
let _devClientService = undefined;
let _settings = undefined;
const timers = [1000, 2000, 2500, 3000, 3500, 4000];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;

    try {
        _devClientService = await initDevClientService();
    } catch (err) {
        Homey.app.error(err);
    }
}   

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function initDevClientService() {
    try {
        Homey.app.log('devClientService - Initializing...');

        const lookupService = new LocalLookupService();
        const address = await lookupService.lookup(_settings.LOCAL_STATION_IP);

        Homey.app.log('devClientService - Found IP address', address);

        const devClientService = new DeviceClientService(address, _settings.P2P_DID, _settings.ACTOR_ID);
        await devClientService.connect();

        Homey.app.log('devClientService - Connected');

        return devClientService;
    } catch (err) {
        Homey.app.error(err);
    }
}

exports.sendCommand = function(a, b, c, id) {
    return new Promise(async (resolve, reject) => {
        if(_devClientService && _devClientService.isConnected()) {
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