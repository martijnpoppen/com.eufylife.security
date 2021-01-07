const Homey = require('homey');
const { PushClient, sleep } = require('eufy-node-client');
const utils = require('../utils.js')
const { MESSAGE_TYPES } = require('../../constants/message_types');

// ---------------------------------------_settings----------------------------------------------------------
let _pushClient = undefined;
let _httpService = undefined;
let _settings = undefined;

// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings, httpService) {
    _settings = settings;
    _httpService = httpService
    
    try {
        Homey.app.trigger_NTFY_BACKGROUND_ACTIVE = new Homey.FlowCardTriggerDevice('trigger_NTFY_BACKGROUND_ACTIVE')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_MOTION_DETECTION = new Homey.FlowCardTriggerDevice('trigger_NTFY_MOTION_DETECTION')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_FACE_DETECTION = new Homey.FlowCardTriggerDevice('trigger_NTFY_FACE_DETECTION')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_PRESS_DOORBELL = new Homey.FlowCardTriggerDevice('trigger_NTFY_PRESS_DOORBELL')
        .registerRunListener(onTriggerNtfy)
        .register();
        
        Homey.app.trigger_NTFY_CRYING_DETECTED = new Homey.FlowCardTriggerDevice('trigger_NTFY_CRYING_DETECTED')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_SOUND_DETECTED = new Homey.FlowCardTriggerDevice('trigger_NTFY_SOUND_DETECTED')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_PET_DETECTED = new Homey.FlowCardTriggerDevice('trigger_NTFY_PET_DETECTED')
        .registerRunListener(onTriggerNtfy)
        .register();

        await eufyPushClient();
    } catch (err) {
        Homey.app.error(err);
    }
   
}   

// ---------------------------------------TRIGGER RUN LISTENERS----------------------------------------------------------

async function onTriggerNtfy(args) {
    console.log(args);
    return new Promise(function (resolve, reject) {
        return resolve();
    });
}

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function eufyPushClient() {
    await sleep(5000);
    _pushClient = await PushClient.init({
        androidId: _settings.CREDENTIALS.checkinResponse.androidId,
        securityToken: _settings.CREDENTIALS.checkinResponse.securityToken,
      });

    _pushClient.connect((msg) => {
        if(+new Date - msg.payload.event_time < 9000) {
            const event_type = utils.get(msg, 'payload.payload.event_type', null);
            const message = utils.keyByValue(MESSAGE_TYPES, event_type);

            const push_count = utils.get(msg, 'payload.payload.push_count', null);

            if(event_type && message && push_count === 1) {
                Homey.app[`trigger_${message}`]
                .trigger()
                .catch( this.error )
                .then( Homey.app.log(`Triggered ${message}`));
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