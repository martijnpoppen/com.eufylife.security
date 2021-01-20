const Homey = require('homey');
const { LocalLookupService, DeviceClientService } = require('eufy-node-client');

// --------------------------------------- SETTINGS ----------------------------------------------------------
let _devClientService = {};
let _settings = undefined;
const timers = [1000, 1500, 2000, 2500];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;

    try {
        Object.keys(_settings.HUBS).forEach(async key => {
            _devClientService[key] = await initDevClientService(_settings.HUBS[key]);
        });
    } catch (err) {
        Homey.app.error(err);
    }
}   

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function initDevClientService(hub) {
    try {
        Homey.app.log('devClientService - Initializing...', hub);

        const lookupService = new LocalLookupService();
        const address = await lookupService.lookup(hub.LOCAL_STATION_IP);

        Homey.app.log('devClientService - Found IP address', address);

        const devClientService = new DeviceClientService(address, hub.P2P_DID, hub.ACTOR_ID);
        await devClientService.connect();

        Homey.app.log('devClientService - Connected', hub.HUB_NAME);

        return devClientService;
    } catch (err) {
        Homey.app.error(err);
    }
}

exports.sendCommand = function(a, b, c, id, station_sn) {
    return new Promise(async (resolve, reject) => {
        if(_devClientService[station_sn] && _devClientService[station_sn].isConnected()) {
            const timer = timers[Math.floor(Math.random() * timers.length)];
            Homey.app.log('Connected to P2P service - ', timer);

            setTimeout(() => {
                if(c === null) {
                    Homey.app.log(`Sending Command with Int - ${id} | value: ${b}`);
                    _devClientService[station_sn].sendCommandWithInt(a, b);
                } else {
                    Homey.app.log(`Sending Command with IntString - ${id} | index: ${c} value: ${b}`);
                    _devClientService[station_sn].sendCommandWithIntString(a, b, c);
                }
                resolve(true);
            }, timer);
        } else {
            Homey.app.error('Not connected to P2P service... Retrying...');
            _devClientService[station_sn] = await initDevClientService(_settings.HUBS[station_sn]);
        }
    });
}

// ---------------------------------------END OF FILE----------------------------------------------------------