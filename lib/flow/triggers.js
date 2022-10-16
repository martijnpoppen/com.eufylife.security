const MESSAGE_TYPES = {
    NTFY_BACKGROUND_ACTIVE: 3100,
    NTFY_MOTION_DETECTION: 3101,
    NTFY_FACE_DETECTION: 3102,
    NTFY_PRESS_DOORBELL: 3103,
    NTFY_CRYING_DETECTED: 3104,
    NTFY_SOUND_DETECTED: 3105,
    NTFY_PET_DETECTED: 3106,
    CMD_SET_ARMING: 010101
}

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
exports.init = async function (homey) {
    try {
        Object.keys(MESSAGE_TYPES).forEach(key => {
            _registerFlowCardTriggerDevice(key, homey);
        });

        _registerFlowCardTriggerDevice('STREAM_STARTED', homey);
    } catch (err) {
        homey.app.error(err);
    }
}


function _registerFlowCardTriggerDevice(key, homey) {
    try {
      homey.app[`trigger_${key}`] = homey.flow.getDeviceTriggerCard(`trigger_${key}`);
    } catch (err) {
      homey.app.error(`failed to register flow card trigger device ${key}`, err.message);
    }
}