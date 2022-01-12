const Homey = require('homey');
const { LocalLookupService,CloudLookupService, DeviceClientService, CommandType, isPrivateIp } = require('../eufy-homey-client');


// ---------------------------------------INIT FUNCTION----------------------------------------------------------
class EufyP2P {
    constructor() {
        this.hubs = {};
        this.hour = 60 * 30 * 1000;
    }

    async init(ctx, settings) {
        try {
            await this.setHubData(settings);

            Homey.app.P2P[settings.STATION_SN] = await this.initP2P(ctx, settings.STATION_SN);
        } catch (err) {
            Homey.app.error(err);
        }
    }

    async setHubData(settings) {
        this.hubs = {...this.hubs, [settings.STATION_SN]: {...settings, lastUpdate: null}};
    }

    async initP2P(ctx, station_sn, retryCount = 2) {
        try {
            const hub = this.hubs[station_sn];
            Homey.app.log(`[P2P] - ${station_sn} - Initializing...`, hub);

            let address = null;

            if(retryCount === 2) {
                const lookupService = new LocalLookupService();
                address = await lookupService.lookup(hub.LOCAL_STATION_IP);    
            } else {
                 // Check if DSK needs to be renewed.
                await ctx.renewDSKKey(ctx);

                const cloudLookupService = new CloudLookupService();
                const addresses = await cloudLookupService.lookup(hub.P2P_DID, hub.DSK_KEY);
                
                Homey.app.log(`P2P ${station_sn} - Found addresses`, addresses);

                if(addresses && addresses.length) {
                    address = !retryCount ? addresses.find(ip => !isPrivateIp(ip.host)) : addresses.find(ip => isPrivateIp(ip.host));
                }
            }

            Homey.app.log(`[P2P] - ${station_sn} - Found IP address`, address);
            
            // ------------------------------------

            const P2P = new DeviceClientService(address, hub.P2P_DID, hub.ACTOR_ID);
            await P2P.connect();

            Homey.app.log(`[P2P] - ${station_sn} - Connected`, hub.HUB_NAME);

            this.hubs[station_sn].lastUpdate = +new Date;

            return P2P;
        } catch (err) {
            Homey.app.log(err);
            if (retryCount < 1) {
                return false;
            }

            Homey.app.log(`[P2P] - ${station_sn} - Connecting failed - retrying `, retryCount - 1);
            return await this.initP2P(ctx, station_sn, retryCount - 1)
        }
    }

    sendCommand(ctx, commandTypeString, station_sn, commandType, value, channel = null, valueSub = 0, strValue = '', nested = null) {
        return new Promise(async (resolve, reject) => {

            const lastUpdate = this.hubs[station_sn].lastUpdate;
            if(lastUpdate && +new Date - lastUpdate > this.hour || !lastUpdate) {
                Homey.app.log(`${station_sn} expired: - ${lastUpdate}`, +new Date - lastUpdate);
                Homey.app.P2P[station_sn] = await this.initP2P(ctx, station_sn);   
            }

            if(!Homey.app.P2P[station_sn] || (!!Homey.app.P2P[station_sn] && !Homey.app.P2P[station_sn].isConnected())) {
                Homey.app.log(`${station_sn} not connected: - retrying..`);
                Homey.app.P2P[station_sn] = await this.initP2P(ctx, station_sn);
            }

            if(Homey.app.P2P[station_sn] && Homey.app.P2P[station_sn].isConnected()) {
                Homey.app.log(`[P2P] - ${station_sn} - Connected to P2P service`);

                if(channel === null && !nested) {

                    Homey.app.log(`[P2P] - ${station_sn} - Sending Command with Int - ${commandTypeString}/${commandType} | value: ${value}`);
                    Homey.app.P2P[station_sn].sendCommandWithInt(commandType, value);

                } else if(nested) {
                    Homey.app.log(`[P2P] - ${station_sn} - Sending Nested Command - ${nested}/${CommandType[nested]} - ${commandTypeString}/${commandType} | value: ${JSON.stringify(value)}`);
                    Homey.app.P2P[station_sn].sendCommandWithStringPayload(nested, JSON.stringify(value), 0);
                } else {
                    Homey.app.log(`[P2P] - ${station_sn} - Sending Command with IntString - ${commandTypeString}/${commandType} | channel: ${channel} | value: ${value} | valueSub ${valueSub} | strValue ${strValue}`);
                    Homey.app.P2P[station_sn].sendCommandWithIntString(commandType, value, valueSub, strValue, channel);
                }
                resolve(true);
            } else {
                Homey.app.error(`[P2P] - ${station_sn} - Not connected to P2P service...`);
            }
        });
    }
}

module.exports = EufyP2P;
// ---------------------------------------END OF FILE----------------------------------------------------------