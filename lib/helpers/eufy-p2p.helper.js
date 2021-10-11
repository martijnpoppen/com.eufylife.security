const Homey = require('homey');
const { LocalLookupService, DeviceClientService, CommandType } = require('../eufy-homey-client');


// ---------------------------------------INIT FUNCTION----------------------------------------------------------
class EufyP2P {
    async init(settings) {
        try {
            this.hubs = settings.HUBS;
            this.hour = 60 * 30 * 1000;

            Object.keys(settings.HUBS).forEach(async station_sn => {
                this.hubs[station_sn].lastUpdate = null;
                Homey.app.P2P[station_sn] = await this.initP2P(this.hubs[station_sn], station_sn);
            });
        } catch (err) {
            Homey.app.error(err);
        }
    }

    async initP2P(hub, station_sn) {
        try {
            Homey.app.log(`P2P ${station_sn} - Initializing...`, hub);

            const lookupService = new LocalLookupService();
            const address = await lookupService.lookup(hub.LOCAL_STATION_IP);

            Homey.app.log(`P2P ${station_sn} - Found IP address`, address);

            const P2P = new DeviceClientService(address, hub.P2P_DID, hub.ACTOR_ID);
            await P2P.connect();

            Homey.app.log(`P2P ${station_sn} - Connected`, hub.HUB_NAME);

            this.hubs[station_sn].lastUpdate = +new Date;
            Homey.app.log(`P2P ${station_sn} - New time:`, this.hubs[station_sn].lastUpdate);

            return P2P;
        } catch (err) {
            Homey.app.error(err);
        }
    }

    sendCommand(commandTypeString, station_sn, commandType, value, channel = null, valueSub = 0, strValue = '', nested = null) {
        return new Promise(async (resolve, reject) => {

            const lastUpdate = this.hubs[station_sn].lastUpdate;
            if(lastUpdate && +new Date - lastUpdate > this.hour || !lastUpdate) {
                Homey.app.log(`${station_sn} expired: - ${lastUpdate}`, +new Date - lastUpdate);
                Homey.app.P2P[station_sn] = await this.initP2P(this.hubs[station_sn], station_sn);   
            }

            if(!Homey.app.P2P[station_sn] || (!!Homey.app.P2P[station_sn] && !Homey.app.P2P[station_sn].isConnected())) {
                Homey.app.log(`${station_sn} not connected: - retrying..`);
                Homey.app.P2P[station_sn] = await this.initP2P(this.hubs[station_sn], station_sn);
            }


            if(Homey.app.P2P[station_sn] && Homey.app.P2P[station_sn].isConnected()) {
                Homey.app.log(`${station_sn} - Connected to P2P service`);

                if(channel === null && !nested) {

                    Homey.app.log(`${station_sn} - Sending Command with Int - ${commandTypeString}/${commandType} | value: ${value}`);
                    Homey.app.P2P[station_sn].sendCommandWithInt(commandType, value);

                } else if(nested) {
                    Homey.app.log(`${station_sn} - Sending Nested Command - ${nested}/${CommandType[nested]} - ${commandTypeString}/${commandType} | value: ${JSON.stringify(value)}`);
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
}

module.exports = EufyP2P;
// ---------------------------------------END OF FILE----------------------------------------------------------