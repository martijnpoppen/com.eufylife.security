const { get, sleep, keyByValue, streamToBuffer } = require('../utils');
const { ARM_TYPES } = require('../../constants/capability_types');
const { PropertyName, AlarmEvent } = require('eufy-security-client');
const fetch = require('node-fetch');
const FormData = require('form-data');
const Homey = require('homey');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
module.exports = class eufyNotificationCheckHelper {
    constructor(homey) {
        this.homey = homey;

        this.setDevices(this.homey.app.deviceList);
        this.init();
    }

    async setDevices(deviceList) {
        this.homey.app.log('[eufyNotificationCheckHelper] - Settings new devices');
        this.deviceList = deviceList;
    }

    async init() {
        try {
            this.homey.app.log('[eufyNotificationCheckHelper] - Init');

            this.homey.app.eufyClient.on('device crying detected', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_CRYING_DETECTED'));
            this.homey.app.eufyClient.on('device sound detected', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_SOUND_DETECTED'));
            this.homey.app.eufyClient.on('device pet detected', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_PET_DETECTED'));
            this.homey.app.eufyClient.on('device vehicle detected', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_VEHICLE_DETECTED'));
            this.homey.app.eufyClient.on('device motion detected', (device, state) => (!device.isMotionSensor() ? this.handleDeviceNotification(device, state, 'NTFY_MOTION_DETECTION') : null));
            this.homey.app.eufyClient.on('device motion detected', (device, state) => (device.isMotionSensor() ? this.handleDeviceNotification(device, state, 'alarm_motion') : null));
            this.homey.app.eufyClient.on('device person detected', (device, state, person) => this.handleDeviceNotification(device, state, 'NTFY_FACE_DETECTION', person));
            this.homey.app.eufyClient.on('device someone loitering', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_LOITERING_DETECTION'));
            this.homey.app.eufyClient.on('device rings', (device, state) => this.handleDeviceNotification(device, state, 'NTFY_PRESS_DOORBELL'));
            this.homey.app.eufyClient.on('station current mode', (station, currentMode) => this.handleDeviceNotification(station, currentMode, 'CMD_SET_ARMING'));
            this.homey.app.eufyClient.on('push message', (message) => this.handlePushMessage(message));
            this.homey.app.eufyClient.on('station livestream start', (station, device, metadata, videostream) => this.handleStream(videostream, device, metadata));

            this.homey.app.eufyClient.on('station alarm event', (station, event) => this.handleDeviceNotification(station, event, 'alarm_generic'));
        } catch (err) {
            this.homey.app.error(err);
        }
    }

    // ---------------------------------------EUFY HELPERS----------------------------------------------------------

    async isAlarmEvent(event) {
        switch (event) {
            case AlarmEvent.DEV_STOP:
            case AlarmEvent.HUB_STOP:
            case AlarmEvent.HUB_STOP_BY_APP:
            case AlarmEvent.HUB_STOP_BY_HAND:
            case AlarmEvent.HUB_STOP_BY_KEYPAD:
                return false;
            default:
                return true;
        }
    }

 
    async handleStream(videoStream, device, metadata) {
        try {
            this.homey.app.log(`[handleStream] - 1. Got handleStream: ${device.getName()} - ${device.getSerial()}`);
            
            const deviceSN = device.getSerial();
            const pairedDevices = this.deviceList;

            const homeyDevice = pairedDevices.find(d => {
                this.homey.app.log(`[handleStream] - 2. Matching device_sn: ${d.HomeyDevice.device_sn} - ${deviceSN}`, d.HomeyDevice.device_sn === deviceSN);
    
                return d.HomeyDevice.device_sn == deviceSN;
            });


            const snapshotLength = this.homey.app.eufyClient.getCameraMaxLivestreamDuration();
            this.homey.app.log(`[handleStream] - 3. Got snapshotLength: ${device.getName()} - ${device.getSerial()}`, snapshotLength);


            streamToBuffer(videoStream).then(async (buffer) => {
                const formData = new FormData();
                formData.append('video', buffer);
                const response = await fetch(`${homeyDevice._snapshot_url}${deviceSN}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'x-secret': homeyDevice._snapshot_custom ? '1234567890' : Homey.env.SNAPSHOT_SECRET,
                    }
                }).catch(e => this.homey.app.error(e));

                this.homey.app.log(`[handleStream] - 4. Saving snapshot: ${deviceSN}`);

                const snapshot = await response.arrayBuffer();
                this.homey.app.snapshots[deviceSN] = Buffer.from(snapshot);
                
                this.homey.app.log(`[handleStream] - 5. Updating image snapshot: ${deviceSN}`, this.homey.app.snapshots[deviceSN]);

                await sleep(300);
                await homeyDevice._image['snapshot'].update();

                // cooldown
                await sleep(1000);
                
            });
        } catch (error) {
            this.homey.app.error('handleStream error', error);
        }
    }

    async handleDeviceNotification(device, state, type, user = null) {
        const pairedDevices = this.deviceList;
        const device_sn = device.getSerial();

        this.homey.app.log(`[NTFY] - 1. handleDeviceNotification: ${device_sn} - ${type}: ${state}`);

        if (type === 'alarm_generic') {
            state = ![AlarmEvent.DEV_STOP, AlarmEvent.HUB_STOP, AlarmEvent.HUB_STOP_BY_APP, AlarmEvent.HUB_STOP_BY_HAND, AlarmEvent.HUB_STOP_BY_KEYPAD].includes(state);
        } else if (type === 'CMD_SET_ARMING' && device.isStation()) {
            // handled by handleGuardModeNotification
            this.homey.app.log(`[NTFY] - 1. SKIP - handleDeviceNotification: ${device_sn} - ${type}: ${state}`);
            return false;
        } else if (type === 'CMD_SET_ARMING') {
            state = keyByValue(ARM_TYPES, parseInt(state));
            user = 'Unkown'
        }

        if (type.includes('alarm_') || state) {
            pairedDevices.every(async (HomeyDevice) => {
                const data = HomeyDevice.getData();
                this.homey.app.debug(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${device_sn}`);

                if (data.device_sn === device_sn) {
                    this.homey.app.log(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${device_sn}`);

                    if(type === 'NTFY_FACE_DETECTION' && user !== null && user !== 'unknown' && user !== 'Unknown') {
                        this.triggerFlow(HomeyDevice, device_sn, 'NTFY_KNOWN_FACE_DETECTION', user, user);
                    }

                    this.triggerFlow(HomeyDevice, device_sn, type, state, user);
                    return false;
                }

                return true;
            });
        } else {
            this.homey.app.log(`[NTFY] - 1. No Match - ${device_sn}`);
        }
    }

    async handlePushMessage(message) {
        this.homey.app.log(`[NTFY] msg`, message);
        this.handleGuardModeNotification(message, 'CMD_SET_ARMING');
        this.handleDoorSensorNotification(message, 'alarm_contact');
    }

    async handleGuardModeNotification(message, type) {
        const pairedDevices = this.deviceList;
        const station_sn = get(message, 'station_sn', 'NOT_FOUND');
        const user = get(message, 'user_name', 'Unknown');
        const state = get(message, 'station_guard_mode', null);

        if (state !== null) {
            pairedDevices.every(async (HomeyDevice) => {
                const data = HomeyDevice.getData();

                this.homey.app.debug(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${station_sn}`);

                if (data.device_sn === station_sn) {
                    this.homey.app.log(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${station_sn}`);

                    const value = keyByValue(ARM_TYPES, parseInt(state));

                    this.triggerFlow(HomeyDevice, station_sn, type, value, user);

                    return false;
                }

                return true;
            });
        }
    }

    async handleDoorSensorNotification(message, type) {
        const pairedDevices = this.deviceList;
        const device_sn = get(message, 'device_sn', 'NOT_FOUND');
        const sensor_open = get(message, 'sensor_open', null);

        if (sensor_open !== null) {
            pairedDevices.every(async (HomeyDevice) => {
                const data = HomeyDevice.getData();

                this.homey.app.debug(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${device_sn}`);

                if (data.device_sn === device_sn) {
                    this.homey.app.log(`[NTFY] - 1. Matching device_sn: ${data.device_sn} - ${device_sn}`);

                    this.triggerFlow(HomeyDevice, device_sn, type, sensor_open);

                    return false;
                }

                return true;
            });
        }
    }

    async triggerFlow(device, device_sn, message, state, user = null) {
        this.homey.app.log(`[NTFY] - 2. Trigger device_sn: ${message} - ${device_sn}`);
        if (message.includes('alarm_')) {
            if (device.hasCapability(message)) {
                await device.setCapabilityValue(message, state).catch(this.homey.app.error);;

                this.homey.app.log(`[NTFY] - 3. ${device.getName()} - Triggered ${message} - with state: ${state}`);
            } else {
                this.homey.app.log(`[NTFY] - 3. ${device.getName()} doesn't contain ${message} - with state: ${state}`);
            }
        } else if (device.hasCapability(message)) {
            if (device._image['event']) {
                this.homey.app.log(`[NTFY] - 2b. Update Image`);
                await sleep(3000);
            }

            await device.onCapability_NTFY_TRIGGER(message, state);

            await sleep(200);

            let tokens = {};

            if (user !== null && typeof user !== 'undefined') {
                tokens = { user: user };
            }

            this.homey.app.log(`[NTFY] - 3. ${device.getName()} - Triggering trigger_${message} - with state: ${state} - tokens: `, tokens);

            this.homey.app[`trigger_${message}`]
                .trigger(device, tokens)
                .catch(this.error)
                .then(this.homey.app.log(`[NTFY] - 4. ${device.getName()} - Triggered ${message} - with state: ${state} - tokens: `, tokens));
        } else {
            this.homey.app.log(`[NTFY] - 4. ${device.getName()} doesn't allow ${message} - with state: ${state}`);
        }
    }
};
// ---------------------------------------END OF FILE----------------------------------------------------------
