const Homey = require('homey');
// const { HttpService, LocalLookupService, DeviceClientService, CommandType } = require('eufy-node-client');

// ---------------------------------------_settings----------------------------------------------------------
// let _devClientService = undefined;
let _settings = undefined;
// const timers = [1000, 2000, 2500, 3000, 3500, 4000];


// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (settings) {
    _settings = settings;
    // _devClientService = await initDevClientService();

    Homey.app.trigger_NTFY_MOTION_DETECTION = new Homey.FlowCardTrigger('trigger_NTFY_MOTION_DETECTION')
    .registerRunListener(onTriggerNtfyMotionDetected)
    .register();

    setTimeout(() => {
        Homey.app.trigger_NTFY_MOTION_DETECTION.trigger()
        .catch( this.error )
        .then( this.log )
    }, 5000);
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


// ---------------------------------------END OF FILE----------------------------------------------------------