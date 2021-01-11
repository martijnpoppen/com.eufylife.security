const Homey = require('homey');
const { PushClient, sleep } = require('eufy-node-client');
const utils = require('../utils.js')
const { MESSAGE_TYPES } = require('../../constants/message_types');

// --------------------------------------- SETTINGS ----------------------------------------------------------
let _pushClient = undefined;
let _httpService = undefined;
let _settings = undefined;
let _devices = undefined;

// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;
    _httpService = Homey.app.getHttpService();
    _devices = Homey.app.getDevices();
    
    try {    
        await eufyPushClient();
    } catch (err) {
        Homey.app.error(err);
    }
   
}

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function eufyPushClient() {
    await sleep(5000);
    _pushClient = await PushClient.init({
        androidId: _settings.CREDENTIALS.checkinResponse.androidId,
        securityToken: _settings.CREDENTIALS.checkinResponse.securityToken,
      });

    _pushClient.connect((msg) => {
        
        if(_settings && _settings.SET_DEBUG) {
            Homey.app.log(`[NTFY] msg`, msg);
        }

        if(+new Date - msg.payload.event_time < 9000) {
            let doorbellPayload = utils.get(msg, 'payload.doorbell', false);

            if (doorbellPayload) {
                Homey.app.log(`[NTFY] - 0. Got 'payload.doorbell' - Parsing JSON`);
                try {
                    msg.payload.doorbell = JSON.parse(doorbellPayload)
                    msg.payload.payload = msg.payload.doorbell
                } catch (e) {
                    Homey.app.log(`Error parsing doorbell payload`, e)
                }
            }

            const event_type = utils.get(msg, 'payload.payload.event_type', null);
            const message = utils.keyByValue(MESSAGE_TYPES, event_type);
            const push_count = utils.get(msg, 'payload.payload.push_count', null);
            const device_sn = utils.get(msg, 'payload.payload.device_sn', null);

            Homey.app.log(`[NTFY] - 1. Got ${message} - ${device_sn} - ${push_count} - ${event_type}`);

            if(event_type && message && push_count !== 2 && device_sn) {
                _devices = Homey.app.getDevices();

                _devices.forEach(device => {
                    const data = device.getData();
                    Homey.app.log(`[NTFY] - 2. Matching device_sn: ${data.device_sn} - ${device_sn}`);
                    if(data.device_sn === device_sn) {
                        Homey.app[`trigger_${message}`]
                        .trigger(device)
                        .catch( this.error )
                        .then(Homey.app.log(`[NTFY] - 3. Triggered ${message}`));
                    }
                });
            }
        }
    });

    const fcmToken = _settings.CREDENTIALS.gcmResponse.token;
    await _httpService.registerPushToken(fcmToken);
    Homey.app.log("Registered at pushService with:", fcmToken);

    await sleep(5000);
    
    await _httpService.pushTokenCheck();

    setInterval(async () => {
        await _httpService.pushTokenCheck();
    }, 5 * 60 * 1000);
}

// ---------------------------------------END OF FILE----------------------------------------------------------