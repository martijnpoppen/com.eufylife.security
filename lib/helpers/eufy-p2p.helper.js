const Homey = require('homey');
const { LocalLookupService, DeviceClientService, CommandType } = require('../eufy-homey-client');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
class EufyP2P  {
    constructor(hub) {
        this.hub = hub;
        this.lastUpdate = null;
        this.hour = 60 * 60 * 1000;
    };

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

    async initP2P() {
        try {
            Homey.app.log('P2P - Initializing...', this.hub);

            const lookupService = new LocalLookupService();
            const address = await lookupService.lookup(this.hub.LOCAL_STATION_IP);

            Homey.app.log('P2P - Found IP address', address);

            const P2P = new DeviceClientService(address, this.hub.P2P_DID, this.hub.ACTOR_ID);
            await P2P.connect();

            Homey.app.log('P2P - Connected', this.hub.HUB_NAME);
            this.lastUpdate = +new Date;
            this.P2P = P2P;
        } catch (err) {
            Homey.app.error(err);
        }
    }

    sendCommand (commandTypeString, station_sn, commandType, value, channel = null, valueSub = 0, strValue = '', nested = null) {
        return new Promise(async (resolve, reject) => {
            if(this.lastUpdate && +new Date - this.lastUpdate > this.hour || !this.lastUpdate) {
                Homey.app.log(`${station_sn} expired: - ${this.lastUpdate}`, +new Date - this.lastUpdate);
                await this.initP2P();   
            }

            if(!this.P2P || (this.P2P && !this.P2P.isConnected())) {
                Homey.app.log(`${station_sn} not connected: - retrying..`);
                await this.initP2P();   
            }


            if(this.P2P && this.P2P.isConnected()) {
                Homey.app.log(`${station_sn} - Connected to P2P service`);

                if(channel === null && !nested) {

                    Homey.app.log(`${station_sn} - Sending Command with Int - ${commandTypeString}/${commandType} | value: ${value}`);
                    this.P2P.sendCommandWithInt(commandType, value);

                } else if(nested) {
                    Homey.app.log(`${station_sn} - Sending Nested Command - CMD_SET_PAYLOAD/${CommandType.CMD_SET_PAYLOAD} - ${commandTypeString}/${commandType} | value: ${JSON.stringify(value)}`);
                    this.P2P.sendCommandWithStringPayload(nested, JSON.stringify(value), 0);
                } else {
                    Homey.app.log(`${station_sn} - Sending Command with IntString - ${commandTypeString}/${commandType} | channel: ${channel} | value: ${value} | valueSub ${valueSub} | strValue ${strValue}`);
                    this.P2P.sendCommandWithIntString(commandType, value, valueSub, strValue, channel);
                }
                resolve(true);
            } else {
                Homey.app.error(`${station_sn} - Not connected to P2P service...`);
            }
        });
    }
}

module.exports = EufyP2P;

// ---------------------------------------END OF FILE----------------------------------------------------------