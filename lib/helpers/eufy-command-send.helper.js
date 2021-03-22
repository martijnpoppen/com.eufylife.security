const Homey = require('homey');
const { LocalLookupService, DeviceClientService } = require('eufy-node-client');

// --------------------------------------- SETTINGS ----------------------------------------------------------
let _devClientService = {};
let _settings = undefined;
let _lastUpdate = null;
const _hour = 60 * 60 * 1000;
const timers = [1000, 1200, 1500];


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
        _lastUpdate = +new Date;
        return devClientService;
    } catch (err) {
        Homey.app.error(err);
    }
}

exports.sendCommand = function(commandTypeString, station_sn, commandType, value, channel = null, valueSub = 0, strValue = '') {
    return new Promise(async (resolve, reject) => {
        if(_lastUpdate && +new Date - _lastUpdate > _hour || 
            !_lastUpdate || 
            (_devClientService[station_sn] && !_devClientService[station_sn].isConnected())) {
            Homey.app.log(`${station_sn} expired: - ${_lastUpdate}`, +new Date - _lastUpdate);
            _devClientService[station_sn] = await initDevClientService(_settings.HUBS[station_sn]);   
        }

        if(_devClientService[station_sn] && _devClientService[station_sn].isConnected()) {
            const timer = timers[Math.floor(Math.random() * timers.length)];
            Homey.app.log(`${station_sn} - Connected to P2P service - `, timer);

            setTimeout(() => {
                if(channel === null) {
                    Homey.app.log(`${station_sn} - Sending Command with Int - ${commandTypeString}/${commandType} | value: ${value}`);
                    _devClientService[station_sn].sendCommandWithInt(commandType, value);
                } else {
                    Homey.app.log(`${station_sn} - Sending Command with IntString - ${commandTypeString}/${commandType} | channel: ${channel} | value: ${value} | valueSub ${valueSub} | strValue ${strValue}`);
                    _devClientService[station_sn].sendCommandWithIntString(commandType, value, valueSub, strValue, channel);
                }
                resolve(true);
            }, timer);
        } else {
            Homey.app.error(`${station_sn} - Not connected to P2P service...`);
        }
    });
}

// ---------------------------------------END OF FILE----------------------------------------------------------