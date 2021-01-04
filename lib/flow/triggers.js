const Homey = require('homey');
const { PushClient, sleep } = require('eufy-node-client');
const utils = require('../utils.js')
const { MESSAGE_TYPES } = require('../../constants/message_types');

// ---------------------------------------_settings----------------------------------------------------------
let _pushClient = undefined;
let _httpService = undefined;
let _settings = undefined;
// const timers = [1000, 2000, 2500, 3000, 3500, 4000];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings, httpService) {
    _settings = settings;
    _httpService = httpService
    
    try {
        Homey.app.trigger_NTFY_BACKGROUND_ACTIVE = new Homey.FlowCardTrigger('trigger_NTFY_BACKGROUND_ACTIVE')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_MOTION_DETECTION = new Homey.FlowCardTrigger('trigger_NTFY_MOTION_DETECTION')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_FACE_DETECTION = new Homey.FlowCardTrigger('trigger_NTFY_FACE_DETECTION')
        .registerRunListener(onTriggerNtfy)
        .register();

        Homey.app.trigger_NTFY_PRESS_DOORBELL = new Homey.FlowCardTrigger('trigger_NTFY_PRESS_DOORBELL')
        .registerRunListener(onTriggerNtfy)
        .register();

        await eufyPushClient();
    } catch (err) {
        Homey.app.error(err);
    }
   
}   

// ---------------------------------------TRIGGER RUN LISTENERS----------------------------------------------------------

async function onTriggerNtfy(args) {
    return new Promise(function (resolve, reject) {
        (function waitForFoo(){
            console.log('Foo called');
            if (lib.foo) return resolve();
            setTimeout(waitForFoo, 30);
        })();
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
        const event_type = utils.get(msg, 'payload.payload.event_type', null);
        const notification_style = utils.get(msg, 'payload.payload.notification_style', null);
        const push_count = utils.get(msg, 'payload.payload.push_count', null);
        const message = utils.keyByValue(MESSAGE_TYPES, event_type);

        if(event_type && message && notification_style === 3 && push_count === 2) {
            Homey.app[`trigger_NTFY_${message}`]
            .trigger()
            .catch( this.error )
            .then( Homey.app.log(`Triggered ${message}`));
        }
    });

    const fcmToken = _settings.CREDENTIALS.gcmResponse.token;
    await _httpService.registerPushToken(fcmToken);
    this.log("Registered at pushService with:", fcmToken);

    await sleep(5000);
    
    await _httpService.pushTokenCheck();

    setInterval(async () => {
        await _httpService.pushTokenCheck();
    }, 5 * 60 * 1000);
}


// ---------------------------------------END OF FILE----------------------------------------------------------