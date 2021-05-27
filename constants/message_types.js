exports.MESSAGE_TYPES = {
    NTFY_BACKGROUND_ACTIVE: 3100,
    NTFY_MOTION_DETECTION: 3101,
    NTFY_FACE_DETECTION: 3102,
    NTFY_PRESS_DOORBELL: 3103,
    NTFY_CRYING_DETECTED: 3104,
    NTFY_SOUND_DETECTED: 3105,
    NTFY_PET_DETECTED: 3106,
    CMD_SET_ARMING: 010101
}

// https://github.com/matijse/eufy-ha-mqtt-bridge/issues/27#issue-778345221
exports.SPECIFIC_MESSAGE_TYPES = {
    NTFY_FACE_DETECTION: "Someone",
    NTFY_MOTION_DETECTION: "Motion",
    CMD_SET_ARMING: "Arming change",
    alarm_motion: "is triggered",
    alarm_generic: "HomeBase is alarming"
}

// DOOR_SENSOR_CHANGED: 100001
exports.PUSH_MESSAGE_TYPES = {
    DOOR_SENSOR_OPEN: '2-1',
    DOOR_SENSOR_CLOSED: '2-0' 
}