const Homey = require('homey');
const { LocalLookupService, DeviceClientService, CommandType } = require('../eufy-homey-client');


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    try {
        this.hubs = settings.HUBS;
        Object.keys(settings.HUBS).forEach(async hub => {
            Homey.app.P2P[hub] = await initP2P(this.hubs[hub]);
        });
    } catch (err) {
        Homey.app.error(err);
    }
}

async function initP2P(hub) {
    try {
        Homey.app.log('P2P - Initializing...', hub);

        const lookupService = new LocalLookupService();
        const address = await lookupService.lookup(hub.LOCAL_STATION_IP);

        Homey.app.log('P2P - Found IP address', address);

        const P2P = new DeviceClientService(address, hub.P2P_DID, hub.ACTOR_ID);
        await P2P.connect();

        Homey.app.log('P2P - Connected', hub.HUB_NAME);

        return P2P;
    } catch (err) {
        Homey.app.error(err);
    }
}

exports.sendCommand = function(commandTypeString, station_sn, commandType, value, channel = null, valueSub = 0, strValue = '', nested = null) {
    return new Promise(async (resolve, reject) => {

        if(!Homey.app.P2P[station_sn] || (!!Homey.app.P2P[station_sn] && !Homey.app.P2P[station_sn].isConnected())) {
            Homey.app.log(`${station_sn} not connected: - retrying..`);
            Homey.app.P2P[station_sn] = await initP2P(this.hubs[station_sn]);
        }


        if(Homey.app.P2P[station_sn] && Homey.app.P2P[station_sn].isConnected()) {
            Homey.app.log(`${station_sn} - Connected to P2P service`);

            if(channel === null && !nested) {

                Homey.app.log(`${station_sn} - Sending Command with Int - ${commandTypeString}/${commandType} | value: ${value}`);
                Homey.app.P2P[station_sn].sendCommandWithInt(commandType, value);

            } else if(nested) {
                Homey.app.log(`${station_sn} - Sending Nested Command - CMD_SET_PAYLOAD/${CommandType.CMD_SET_PAYLOAD} - ${commandTypeString}/${commandType} | value: ${JSON.stringify(value)}`);
                Homey.app.P2P[station_sn].sendCommandWithStringPayload(nested, JSON.stringify(value), 0);
            } else {
                Homey.app.log(`${station_sn} - Sending Command with IntString - ${commandTypeString}/${commandType} | channel: ${channel} | value: ${value} | valueSub ${valueSub} | strValue ${strValue}`);
                Homey.app.P2P[station_sn].sendCommandWithIntString(commandType, value, valueSub, strValue, channel);
            }
            resolve(true);
        } else {
            Homey.app.error(`${station_sn} - Not connected to P2P service...`);
        }
    });
}

// ---------------------------------------END OF FILE----------------------------------------------------------