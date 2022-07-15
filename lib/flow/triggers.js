const Homey = require('homey');
const { MESSAGE_TYPES } = require('../../constants/message_types');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
exports.init = async function () {    
    try {
        Object.keys(MESSAGE_TYPES).forEach(key => {
            _registerFlowCardTriggerDevice(key);
        });

        _registerFlowCardTriggerDevice('STREAM_STARTED');
    } catch (err) {
        Homey.app.error(err);
    }
}


function _registerFlowCardTriggerDevice(key) {
    try {
      Homey.app[`trigger_${key}`] = new Homey.FlowCardTriggerDevice(`trigger_${key}`).register();
    } catch (err) {
      Homey.app.error(`failed to register flow card trigger device ${key}`, err.message);
    }
}