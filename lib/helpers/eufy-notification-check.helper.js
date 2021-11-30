const Homey = require('homey');
const { PushClient, sleep } = require('../eufy-homey-client');
const utils = require('../utils.js')
const { MESSAGE_TYPES, SPECIFIC_MESSAGE_TYPES, PUSH_MESSAGE_TYPES } = require('../../constants/message_types');
const { DEVICE_TYPES } = require('../../constants/device_types');
const { ARM_TYPES } = require('../../constants/capability_types');

// --------------------------------------- SETTINGS ----------------------------------------------------------
let _pushClient = undefined;
let _httpService = undefined;
let _settings = undefined;

// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;
    _httpService = Homey.app.getHttpService();
    
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
        let _msg = msg;
        let hasDoorbell = utils.get(_msg, 'payload.doorbell', false);

        if (hasDoorbell) {
            _msg = convertDoorbellPayload(_msg, hasDoorbell);
        }
        
        Homey.app.log(`[NTFY] msg`, _msg);

        if(+new Date - _msg.sent < 11000) {
            const {event_type, message, device_sn, push_count, pic_url, value, notification_style} = getData(_msg);
            Homey.app.log(`[NTFY] - 1. Got ${message} - ${device_sn} - ${push_count} - ${event_type} - ${value}`);

            if(event_type && message && device_sn && (pic_url && push_count !== 2 && notification_style !== 3 || pic_url && push_count === 2 && notification_style === 3 || push_count !== 2 && notification_style !== 3 || notification_style === 3 && DEVICE_TYPES.FLOODLIGHT_CAMERA.some(d => device_sn.startsWith(d)))) {
                deviceMatch(device_sn, message, value, pic_url)
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

function convertDoorbellPayload(msg, hasDoorbell) {
    // Fix for (T8200 - Video doorbell 2k Powered)
    let _msg = msg;
    Homey.app.log(`[NTFY] - 0. Got 'payload.doorbell' - Parsing JSON`);
    try {
        _msg.payload.doorbell = JSON.parse(hasDoorbell)
        _msg.payload.payload = _msg.payload.doorbell
        return _msg;
    } catch (e) {
        Homey.app.log(`Error parsing doorbell payload`, e)
    }
}

function getData(msg) {
    let value = null;
    let event_type = utils.get(msg, 'payload.payload.event_type', null);
    let message = utils.keyByValue(MESSAGE_TYPES, event_type);
    let device_sn = utils.get(msg, 'payload.payload.device_sn', null);
    const push_count = utils.get(msg, 'payload.payload.push_count', null);
    const pic_url = utils.get(msg, 'payload.payload.pic_url', null);
    const notification_style = utils.get(msg, 'payload.payload.notification_style', null)
    
    if(event_type === null){
        // Fix for eufycam 2/motion sensor/floodlight
        event_type = utils.get(msg, 'payload.content', null);
        Homey.app.log(`[NTFY] - 0. Event_type not found - Trying to convert content`, event_type);
        
        if(event_type && event_type.includes(':')) {
            event_type = utils.convertContent(event_type);
            message = utils.keyByValue(SPECIFIC_MESSAGE_TYPES, event_type);
            Homey.app.log(`[NTFY] - 0. Event_type not found - Trying to convert content`, `event_type includes : `, event_type, message);
         } else if(event_type) {
            message = message = utils.keyByValueIncludes(SPECIFIC_MESSAGE_TYPES, event_type);
            event_type = SPECIFIC_MESSAGE_TYPES[message];
            value = utils.get(msg, 'payload.payload.mode', null);
            value = value !== null ? utils.keyByValue(ARM_TYPES, parseInt(value)) : null;

            Homey.app.log(`[NTFY] - 0. Event_type not found - Trying to convert content`, `event_type does not include : `, event_type, message);
        }

        device_sn = utils.get(msg, 'payload.device_sn', null);
        if(!device_sn) device_sn = utils.get(msg, 'payload.station_sn', null);
    }

    if(!event_type){
        const value = utils.get(msg, 'payload.payload.e', null);
        event_type = utils.get(msg, 'payload.type', null);
        message = utils.keyByValue(PUSH_MESSAGE_TYPES, `${event_type}-${value}`);
    }
    
    return {event_type, message, device_sn, push_count, pic_url, value, notification_style}
}

async function setDeviceImage(device, pic_url) {
    if(pic_url) {
        Homey.app.log(`[NTFY] - 2b. Found Image url: ${pic_url}`);
        await device.deviceImage(pic_url);
        await sleep(1500);
    }
}

async function deviceMatch(device_sn, message, value, pic_url) {
    const pairedDevices = await Homey.app.getDevices();

    pairedDevices.every(async device => {
        const data = device.getData();
        Homey.app.log(`[NTFY] - 2. Matching device_sn: ${data.device_sn} - ${device_sn}`);
        
        if(data.device_sn === device_sn) {
            triggerNTFY(device, device_sn, message, value, pic_url);
            return false;
        }

        return true;
    });
}

async function triggerNTFY(device, device_sn, message, value, pic_url) {
    if(DEVICE_TYPES.DOOR_SENSOR.some(d => device_sn.startsWith(d))) {
        const sensorValue = message === 'DOOR_SENSOR_OPEN' ? true : false;
        await device.setCapabilityValue('alarm_contact', sensorValue);

        Homey.app.log(`[NTFY] - 3. Triggered ${message} - value: ${sensorValue}`);
        
    } else if(message.startsWith('alarm_generic')) {
        const sensorValue = message === 'alarm_generic_on' ? true : false;
        await device.setCapabilityValue('alarm_generic', sensorValue);

        Homey.app.log(`[NTFY] - 3. Triggered ${message} - value: ${sensorValue}`);
    } else {
        await setDeviceImage(device, pic_url);

        if(message === 'CMD_SET_ARMING' && device.getCapabilityValue(message) == value) {
            Homey.app.log(`[NTFY] - 3. NOT Triggered ${message} - value: ${value} - (Value is equal)`)
        } else {
            device.onCapability_NTFY_TRIGGER(message, value);
            
            if(!message.includes('alarm_')) {
                await sleep(200);

                Homey.app[`trigger_${message}`]
                .trigger(device)
                .catch( this.error )
                .then(Homey.app.log(`[NTFY] - 3. Triggered ${message} - value: ${value}`)); 
            } else {
                Homey.app.log(`[NTFY] - 3. Triggered ${message} - value: ${value}`)
            }
        }
       
    }
}

// ---------------------------------------END OF FILE----------------------------------------------------------