const Homey = require('homey');
const { PushClient, HttpService, sleep } = require('eufy-node-client');

// ---------------------------------------_settings----------------------------------------------------------
let _pushClient = undefined;
let _httpService = undefined;
let _settings = undefined;
// const timers = [1000, 2000, 2500, 3000, 3500, 4000];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;
    
    if(!_httpService) { 
        await initHttpService();
    }
    
    eufyPushClient();

    Homey.app.trigger_NTFY_MOTION_DETECTION = new Homey.FlowCardTrigger('trigger_NTFY_MOTION_DETECTION')
    .registerRunListener(onTriggerNtfyMotionDetected)
    .register();
}   

// ---------------------------------------TRIGGER RUN LISTENERS----------------------------------------------------------

async function onTriggerNtfyMotionDetected(args) {
    return new Promise(function (resolve, reject) {
        (function waitForFoo(){
            console.log('Foo called');
            if (lib.foo) return resolve();
            setTimeout(waitForFoo, 30);
        })();
    });
}

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

async function initHttpService() {
    try {
        _httpService = new HttpService(_settings.USERNAME, _settings.PASSWORD);
    } catch (err) {
        Homey.app.error(err);
    }
}

async function eufyPushClient() {
    _pushClient = await PushClient.init({
        androidId: _settings.CREDENTIALS.checkinResponse.androidId,
        securityToken: _settings.CREDENTIALS.checkinResponse.securityToken,
      });

    _pushClient.connect((msg) => {
        Homey.app.trigger_NTFY_MOTION_DETECTION.trigger().catch( this.error ).then( msg )
    });
    
    await _httpService.pushTokenCheck();

    setInterval(async () => {
        await _httpService.pushTokenCheck();
    }, 5 * 60 * 1000);
}


// ---------------------------------------END OF FILE----------------------------------------------------------