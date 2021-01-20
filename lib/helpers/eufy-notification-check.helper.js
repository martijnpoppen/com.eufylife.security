const Homey = require('homey');
const fetch = require('node-fetch');
const { PushClient, sleep } = require('eufy-node-client');
const utils = require('../utils.js')
const { MESSAGE_TYPES, SPECIFIC_MESSAGE_TYPES } = require('../../constants/message_types');

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
        let hasDoorbell = utils.get(msg, 'payload.doorbell', false);

        if (hasDoorbell) {
            convertDoorbellPayload(msg);
        }
        
        if(_settings && _settings.SET_DEBUG) {
            Homey.app.log(`[NTFY] msg`, msg);
        }

        if(+new Date - msg.sent < 11000) {
            const {event_type, message, device_sn, push_count, pic_url} = getData(msg)

            Homey.app.log(`[NTFY] - 1. Got ${message} - ${device_sn} - ${push_count} - ${event_type}`);

            if(event_type && message && push_count !== 2 && device_sn) {
                _devices = Homey.app.getDevices();

                _devices.forEach(async device => {
                    const data = device.getData();
                    Homey.app.log(`[NTFY] - 2. Matching device_sn: ${data.device_sn} - ${device_sn}`);
                    if(data.device_sn === device_sn) {
                        await setDeviceImage(device, pic_url);

                        Homey.app[`trigger_${message}`]
                        .trigger(device)
                        .catch( this.error )
                        .then(Homey.app.log(`[NTFY] - 3. Triggered ${message}`)); 
                    }
                });
            } else {
                Homey.app.log(`[NTFY] - 2. Invalid ${message} (count: ${push_count}) - device_sn: ${device_sn} - ${event_type}`);
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

async function convertDoorbellPayload() {
    // Fix for (T8200 - Video doorbell 2k Powered)
    Homey.app.log(`[NTFY] - 0. Got 'payload.doorbell' - Parsing JSON`);
    try {
        msg.payload.doorbell = JSON.parse(hasDoorbell)
        msg.payload.payload = msg.payload.doorbell
    } catch (e) {
        Homey.app.log(`Error parsing doorbell payload`, e)
    }
}

async function getData(msg) {
    let event_type = utils.get(msg, 'payload.payload.event_type', null);
    let message = utils.keyByValue(MESSAGE_TYPES, event_type);
    let device_sn = utils.get(msg, 'payload.payload.device_sn', null);
    const push_count = utils.get(msg, 'payload.payload.push_count', null);
    const pic_url = utils.get(msg, 'payload.payload.pic_url', null);
    
    if(event_type === null){
        // Fix for eufycam 2/motion sensor/floodlight
        Homey.app.log(`[NTFY] - 0. Even_type not found - Trying to convert content`);
        event_type = utils.get(msg, 'payload.content', null);
        event_type = event_type && utils.convertContent(event_type);
        message = utils.keyByValue(SPECIFIC_MESSAGE_TYPES, event_type);
        device_sn = utils.get(msg, 'payload.device_sn', null);
    }
    
    return {event_type, message, device_sn, push_count, pic_url}
}

async function setDeviceImage(device, pic_url) {
    if(pic_url) {
        Homey.app.log(`[NTFY] - 2b. Found Image url: ${pic_url}`);
        await device._image.setStream(async (stream) => {
            const res = await fetch(pic_url);
            if(!res.ok)
              throw new Error('Invalid Response');
          
            return res.body.pipe(stream);
          });
        await device._image.update();
        await sleep(1300);
    }
}

// ---------------------------------------END OF FILE----------------------------------------------------------