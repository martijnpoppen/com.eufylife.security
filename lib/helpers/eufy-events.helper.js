'use strict';

const { PropertyName, AlarmEvent } = require('eufy-security-client');
const fs = require('fs');
const path = require('path');

const { sleep, keyByValue } = require('../utils');
const { ARM_TYPES } = require('../../constants/capability_types');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------
module.exports = class eufyEventsHelper {
    constructor(homey) {
        this.homey = homey;

        this.setDevices(this.homey.app.deviceList);
        this.init();
    }

    async setDevices(deviceList) {
        this.homey.app.log('[eufyEventsHelper] - Setting new devices');
        this.deviceList = deviceList;
    }

    async init() {
        try {
            this.homey.app.log('[eufyEventsHelper] - Init');

            this.homey.app.eufyClient.on('device property changed', (device, name, value) => {
                const device_sn = device.rawDevice.device_sn;
                const homeyDevice = this.deviceList.find((d) => device_sn === d.HomeyDevice.device_sn);
                if (homeyDevice) {
                    this.updateDeviceProperties(homeyDevice, device, name, value);
                }
            });

            this.homey.app.eufyClient.on('station property changed', (station, name, value) => {
                const station_sn = station.getSerial();
                const homeyStation = this.deviceList.find((d) => station_sn === d.HomeyDevice.device_sn);
                if (homeyStation) {
                    this.updateDeviceProperties(homeyStation, station, name, value);
                }
            });

            this.homey.app.eufyClient.on('station livestream start', (station, device, metadata, videostream, audioStream) =>
                this.homey.app.FfmpegManager.streamHandler(videostream, audioStream, device, station)
            );
            // this.homey.app.eufyClient.on('station livestream stop', (station, device) => this.homey.app.FfmpegManager.stopStream(device));
            this.homey.app.eufyClient.pushService.on('raw message', (message) => this.handleRawMessage(message));
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async handleRawMessage(message) {
        this.homey.app.log(`[NTFY] raw msg`, message);
    }

    async updateDeviceProperties(HomeyDevice, EufyDevice, name, value) {
        // ---- Special capability mapping ----

        if ((name === PropertyName.DevicePicture || name === PropertyName.DevicePictureUrl) && HomeyDevice._image['event']) {
            const userDataPath = path.resolve(__dirname, '/userdata/');
            const eventPath = path.join(userDataPath, `${EufyDevice.getSerial()}_event.jpg`);

            // Create a promise that represents "event image is ready"

            try {
                const picture = await EufyDevice.getPropertyValue(PropertyName.DevicePicture);
                const buf = Buffer.from(picture.data, 'base64');
                await fs.promises.writeFile(eventPath, buf);

                this.homey.app.log(`[eufyEventsHelper] - ${HomeyDevice.getName()}  - Property: ${name} - Saved event image: ${eventPath}`);

                await HomeyDevice.updateImage('event', EufyDevice.getSerial());

                this.homey.app.log(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Event image updated on HomeyDevice`, EufyDevice.getSerial());
            } catch (err) {
                this.homey.app.error(`[eufyEventsHelper] - ${HomeyDevice.getName()}  - Failed to prepare event image for ${HomeyDevice.getName()}:`, err);
            }
        }

        const extraFunctionEventImage = async () => {
            if (HomeyDevice._image['event'] && value === true) {
                this.homey.app.log(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Waiting for event image promise to resolve`);

                try {
                    const maxRetries = 15;
                    let retries = 0;
                    while (retries < maxRetries) {
                        await sleep(500); // wait for 500ms before checking again
                        if (HomeyDevice._imageTimeStamp['event'] >= Date.now() - 3000) {
                            this.homey.app.log(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Event image is ready after ${retries + 1} retries`);
                            return;
                        }
                        retries++;
                    }
                    this.homey.app.warn(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Event image was not ready after ${maxRetries} retries`);
                } catch (err) {
                    this.homey.app.error(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Event image promise rejected:`, err);
                }
            }
        };

        // --- Regular capability mapping ----

        let triggeredProperty = {};
        switch (name) {
            case PropertyName.DeviceMotionDetected:
                triggeredProperty = {
                    capability: EufyDevice.getPropertyValue(PropertyName.DeviceMotionSensorPIREvent) ? 'alarm_motion' : 'NTFY_MOTION_DETECTION',
                    extraFunctions: () => (EufyDevice.getPropertyValue(PropertyName.DeviceMotionSensorPIREvent) ? () => {} : extraFunctionEventImage()),
                    triggerFlow: EufyDevice.getPropertyValue(PropertyName.DeviceMotionSensorPIREvent) ? false : true,
                    triggerFlowCallback: async () => value === true
                };
                break;
            case PropertyName.DevicePersonDetected:
            case PropertyName.DeviceIdentityPersonDetected:
            case PropertyName.DeviceStrangerPersonDetected:
                triggeredProperty = {
                    capability: 'NTFY_FACE_DETECTION',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage(),
                    tokens: async () => ({ user: EufyDevice.getPropertyValue(PropertyName.DevicePersonName) || 'Unknown' })
                };
                break;
            case PropertyName.DevicePersonName:
                triggeredProperty = {
                    capability: 'NTFY_KNOWN_FACE_DETECTION',
                    triggerFlowCallback: async () => value !== 'Unknown' && value.length && value !== '',
                    extraFunctions: () => extraFunctionEventImage(),
                    tokens: async () => ({ user: EufyDevice.getPropertyValue(PropertyName.DevicePersonName) || 'Unknown' })
                };
                break;
            case PropertyName.DeviceLoiteringDetected:
                triggeredProperty = {
                    capability: 'NTFY_LOITERING_DETECTION',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DeviceRinging:
                triggeredProperty = {
                    capability: 'NTFY_PRESS_DOORBELL',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DeviceCryingDetected:
                triggeredProperty = {
                    capability: 'NTFY_CRYING_DETECTED',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DevicePetDetected:
                triggeredProperty = {
                    capability: 'NTFY_PET_DETECTED',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DeviceVehicleDetected:
                triggeredProperty = {
                    capability: 'NTFY_VEHICLE_DETECTED',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DeviceSoundDetected:
                triggeredProperty = {
                    capability: 'NTFY_SOUND_DETECTED',
                    triggerFlowCallback: async () => value === true,
                    extraFunctions: () => extraFunctionEventImage()
                };
                break;
            case PropertyName.DeviceBatteryTemp:
                triggeredProperty = {
                    capability: 'measure_temperature',
                    triggerFlow: false
                };
                break;
            case PropertyName.DeviceBattery:
                triggeredProperty = {
                    capability: 'measure_battery',
                    triggerFlow: false
                };
                break;
            case PropertyName.DeviceEnabled:
                triggeredProperty = {
                    capability: 'onoff',
                    triggerFlow: false
                };
                break;
            case PropertyName.DeviceSensorOpen:
                triggeredProperty = {
                    capability: 'alarm_contact',
                    triggerFlow: false
                };
                break;
            case PropertyName.StationGuardMode:
                triggeredProperty = {
                    capability: 'CMD_SET_ARMING',
                    triggerFlow: true,
                    tokens: async () => {
                        await sleep(2000);
                        return { user: EufyDevice.getPropertyValue(PropertyName.StationPersonName) };
                    },
                    extraFunctions: async () => {
                        await HomeyDevice.set_alarm_arm_mode(value);
                    },
                    overrideValue: () => {
                        return keyByValue(ARM_TYPES, parseInt(value));
                    }
                };
                break;
            case PropertyName.StationAlarm:
                triggeredProperty = {
                    capability: 'alarm_generic',
                    triggerFlow: false
                    // overrideValue: () => ![AlarmEvent.DEV_STOP, AlarmEvent.HUB_STOP, AlarmEvent.HUB_STOP_BY_APP, AlarmEvent.HUB_STOP_BY_HAND, AlarmEvent.HUB_STOP_BY_KEYPAD].includes(value)
                };
                break;
            default:
                return;
        }

        // ---- Regular capability mapping ----

        const { capability } = triggeredProperty || {};

        this.homey.app.debug(`[eufyEventsHelper] - updateDeviceProperties - Property: ${name} - EufyDevice: ${EufyDevice.getName()} - HomeyDevice: ${HomeyDevice.getName()} - Value: ${value}`);

        if (capability && HomeyDevice.hasCapability(capability)) {
            if ('overrideValue' in triggeredProperty) {
                value = triggeredProperty.overrideValue();
            }

            if ('extraFunctions' in triggeredProperty) {
                await triggeredProperty.extraFunctions();
            }

            if (triggeredProperty.triggerFlow || ('triggerFlowCallback' in triggeredProperty && (await triggeredProperty.triggerFlowCallback()))) {
                await HomeyDevice.onCapability_NTFY_TRIGGER(capability, value);

                let tokens = {};

                if ('tokens' in triggeredProperty) {
                    tokens = (await triggeredProperty.tokens()) || {};
                }

                if (this.homey.app[`trigger_${capability}`]) {
                    this.homey.app[`trigger_${capability}`]
                        .trigger(HomeyDevice, tokens)
                        .catch(this.error)
                        .then(this.homey.app.log(`[eufyEventsHelper] - TriggerFlow ${HomeyDevice.getName()} - Triggered ${capability} - with value: ${value} - tokens: `, tokens));
                }
            } else if (triggeredProperty.triggerFlow === false) {
                this.homey.app.log(`[eufyEventsHelper] - ${HomeyDevice.getName()} - Updating capability ${capability} with value: ${value}`);
                await HomeyDevice.onCapability_NTFY_TRIGGER(capability, value);
            }
        }
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
