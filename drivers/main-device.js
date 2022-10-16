const Homey = require('homey');
const fetch = require('node-fetch');
const { ARM_TYPES } = require('../constants/capability_types');
const { sleep } = require('../lib/utils.js');
const { PropertyName } = require('eufy-security-client');

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        await this.setupDevice();

        this.homey.app.homeyEvents.once('eufyClientConnected', () => {
            this.onStartup();
        })
    }

    async onStartup() {
        try {
            this.homey.app.log('[Device] - starting =>', this.getName());

            this.EufyDevice = await this.homey.app.eufyClient.getDevice(this.HomeyDevice.device_sn);
            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);
    
            this.EufyStation.rawStation.member.nick_name = 'Homey';
    
            await this.deviceImage();
            await this.resetCapabilities();
            await this.checkCapabilities();
            await this.setCapabilitiesListeners();
    
            await this.setAvailable();
        } catch (error) {
            this.setUnavailable(error);
            this.homey.app.log(error);
        }
    }

    onAdded() {
        this.homey.app.setDevice(this);
    }

    onDeleted() {
        const deviceObject = this.getData();
        this.homey.app.removeDevice(deviceObject.device_sn);
    }

    async onSettings(oldSettings, newSettings, changedKeys) {
        this.homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);

        if (this.hasCapability('alarm_generic') && changedKeys.includes('alarm_generic_enabled')) {
            this.resetCapability('alarm_generic');
        }
    }

    async setupDevice() {
        this.homey.app.log('[Device] - init =>', this.getName());

        this.setUnavailable(`Initializing ${this.getName()}`);

        const deviceObject = this.getData();
        this.HomeyDevice = deviceObject;
        this._image = null;

        await sleep(6500);
    }

    async resetCapabilities() {
        try {
            if (this.hasCapability('alarm_motion')) {
                this.resetCapability('alarm_motion');
            }

            if (this.hasCapability('alarm_contact')) {
                this.resetCapability('alarm_contact');
            }

            if (this.hasCapability('alarm_generic')) {
                this.resetCapability('alarm_generic');
            }
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async resetCapability(name, value = false) {
        this.setCapabilityValue(name, value);
    }

    async checkCapabilities() {
        const driverManifest = this.driver.manifest;
        const driverCapabilities = driverManifest.capabilities;
        const deviceCapabilities = this.getCapabilities();

        this.homey.app.log(`[Device] ${this.getName()} - checkCapabilities for`, driverManifest.id);
        this.homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);

        if (this.driver.id === 'driver_VIDEO_DOORBELL_1080P_POWERED' || this.driver.id === 'driver_VIDEO_DOORBELL_2K_POWERED') {
            await this.removeCapability('CMD_SET_SNOOZE_MODE');
            await sleep(1000);
        }

        await this.updateCapabilities(driverCapabilities, deviceCapabilities);

        return;
    }

    async updateCapabilities(driverCapabilities, deviceCapabilities) {
        try {
            const newC = driverCapabilities.filter((d) => !deviceCapabilities.includes(d));
            const oldC = deviceCapabilities.filter((d) => !driverCapabilities.includes(d));

            this.homey.app.log(`[Device] ${this.getName()} - Got old capabilities =>`, oldC);
            this.homey.app.log(`[Device] ${this.getName()} - Got new capabilities =>`, newC);

            oldC.forEach((c) => {
                this.homey.app.log(`[Device] ${this.getName()} - updateCapabilities => Remove `, c);
                this.removeCapability(c);
            });
            await sleep(2000);
            newC.forEach((c) => {
                this.homey.app.log(`[Device] ${this.getName()} - updateCapabilities => Add `, c);
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async setCapabilitiesListeners() {
        try {
            this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));

            if (this.hasCapability('CMD_SET_ARMING')) {
                this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));
            }

            if (this.hasCapability('CMD_DOORBELL_QUICK_RESPONSE')) {
                this.registerCapabilityListener('CMD_DOORBELL_QUICK_RESPONSE', this.onCapability_CMD_DOORBELL_QUICK_RESPONSE.bind(this));
            }

            if (this.hasCapability('CMD_SET_FLOODLIGHT_MANUAL_SWITCH')) {
                this.registerCapabilityListener('CMD_SET_FLOODLIGHT_MANUAL_SWITCH', this.onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH.bind(this));
            }

            if (this.hasCapability('CMD_IRCUT_SWITCH')) {
                this.registerCapabilityListener('CMD_IRCUT_SWITCH', this.onCapability_CMD_IRCUT_SWITCH.bind(this));
            }

            if (this.hasCapability('CMD_BAT_DOORBELL_VIDEO_QUALITY')) {
                this.registerCapabilityListener('CMD_BAT_DOORBELL_VIDEO_QUALITY', this.onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY.bind(this));
            }

            if (this.hasCapability('CMD_BAT_DOORBELL_WDR_SWITCH')) {
                this.registerCapabilityListener('CMD_BAT_DOORBELL_WDR_SWITCH', this.onCapability_CMD_BAT_DOORBELL_WDR_SWITCH.bind(this));
            }
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async onCapability_CMD_DEVS_SWITCH(value) {
        const settings = this.getSettings();

        try {
            if (!value && settings && settings.override_onoff) {
                throw new Error('Device always-on enabled in settings');
            }

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DEVS_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceEnabled, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_ARMING(value) {
        const settings = this.getSettings();

        try {
            let CMD_SET_ARMING = ARM_TYPES[value];

            if (CMD_SET_ARMING == '6') {
                throw new Error('Not available for this device');
            }

            this.EufyStation.rawStation.member.nick_name = 'Homey';

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING - `, value, CMD_SET_ARMING);
            await this.homey.app.eufyClient.setStationProperty(this.HomeyDevice.station_sn, PropertyName.StationGuardMode, CMD_SET_ARMING);

            if (settings.alarm_arm_mode) {
                await this.setCapabilityValue('alarm_arm_mode', value === 'disarmed' || value === 'off');
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_DOORBELL_QUICK_RESPONSE(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DOORBELL_QUICK_RESPONSE - `, value);
            const voices = this.EufyDevice.getVoices();

            if (voices && Object.keys(voices).length >= value) {
                const currentVoice = Object.keys(voices)[value - 1];

                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DOORBELL_QUICK_RESPONSE - trigger voice`, currentVoice);

                await this.EufyStation.quickResponse(this.EufyDevice, parseInt(currentVoice));
            } else {
                throw Error("Voice doesn't exist");
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_REBOOT_HUB() {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_REBOOT_HUB`);

            await this.EufyStation.rebootHUB();

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_INDOOR_PAN_TURN(value = '360', repeat = 1) {
        const obj = {
            360: 0,
            left: 1,
            right: 2,
            up: 3,
            down: 4
        };

        for (let i = 0; i < repeat; i++) {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_INDOOR_PAN_TURN - `, value, repeat);
            await this.EufyStation.panAndTilt(this.EufyDevice, obj[value]);
        }
    }

    async onCapability_CMD_BAT_DOORBELL_WDR_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_BAT_DOORBELL_WDR_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceVideoWDR, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.setVideoStreamingQuality, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_IRCUT_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_IRCUT_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceAutoNightvision, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_SNOOZE_MODE(homebase = 0, motion = 0, snooze = 0, chime = 0) {
        const payload = {
            snooze_homebase: !!homebase,
            snooze_motion: !!motion,
            snooze_chime: !!chime,
            snooze_time: 30
        };

        this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_SNOOZE_MODE - `, payload);
        await this.EufyStation.snooze(this.EufyDevice, payload);
    }

    async onCapability_CMD_TRIGGER_ALARM(seconds) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, seconds);

            await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, time + 2);
            // time + 2 so we can disable alarm manually.

            // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
            await sleep(time * 1000);

            await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, 0);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, 0);
            await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, 0);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceLight, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_DEV_LED_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DEV_LED_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceStatusLed, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_START_STOP_STREAM(streamType) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - streamType - `, streamType);

            if (streamType || streamType === '') {
                let streamUrl = await this.EufyDevice.startStream();
                const localAddress = await this.homey.app.getStreamAddress();
                let internalStreamUrl = '';

                if (streamUrl && streamType.includes('hls')) {
                    this.homey.app.log(`[Device] ${this.getName()} - streamType - ${streamType}`, streamUrl);

                    streamUrl = streamUrl.replace('rtmp', 'https');
                    streamUrl = streamUrl.split('/hls/');

                    const streamKey = streamUrl[1].split('?');

                    internalStreamUrl = `${streamUrl[0]}:1443/hls/${streamKey[0]}.m3u8`;

                    if (streamType === 'hls_only') {
                        streamUrl = internalStreamUrl;
                    } else {
                        streamUrl = `${localAddress}/app/${Homey.manifest.id}/settings/stream?device_sn=${this.HomeyDevice.device_sn}`;
                    }
                }

                this.homey.app.log(`[Device] ${this.getName()} - streamType - ${streamType}`, streamUrl);

                await this.setCapabilityValue('CMD_START_STREAM', streamUrl);
                await this.setSettings({ CLOUD_STREAM_URL: internalStreamUrl });

                this.homey.app[`trigger_STREAM_STARTED`].trigger(this, { url: streamUrl }).catch(this.error).then(this.homey.app.log(`[NTFY] - Triggered trigger_STREAM_STARTED`));
            } else {
                await this.setCapabilityValue('CMD_START_STREAM', 'No stream found');
                await this.EufyDevice.stopStream();
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            if (typeof e === 'object') {
                return Promise.reject(JSON.stringify(e));
            }
            return Promise.reject(e);
        }
    }

    async onCapability_NTFY_TRIGGER(message, value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => `, message, value);
            const isNormalEvent = message !== 'CMD_SET_ARMING';
            const settings = this.getSettings();
            const setMotionAlarm = message !== 'NTFY_PRESS_DOORBELL' && !!settings.alarm_motion_enabled;

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_NTFY_TRIGGER => isNormalEvent - setMotionAlarm`, isNormalEvent, setMotionAlarm);

            if (this.hasCapability(message)) {
                if (isNormalEvent) {
                    this.setCapabilityValue(message, true);

                    if (setMotionAlarm) {
                        this.setCapabilityValue('alarm_motion', true);
                    }
                } else {
                    this.setCapabilityValue(message, value);
                    if (settings.alarm_arm_mode && settings.alarm_arm_mode !== 'disabled') {
                        const values = settings.alarm_arm_mode.split('_');
                        await this.setCapabilityValue('alarm_arm_mode', values.includes(value));
                    } else {
                        await this.setCapabilityValue('alarm_arm_mode', false);
                    }
                }

                await sleep(5000);

                if (isNormalEvent) {
                    this.setCapabilityValue(message, false);

                    if (setMotionAlarm) {
                        await sleep(5000);
                        this.setCapabilityValue('alarm_motion', false);
                    }
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async deviceImage() {
        try {
            if (!this._image) {
                this._image = await this.homey.images.createImage();
                this._image.setStream(async (stream) => {
                    const imagePath = this.EufyDevice.getLastCameraImageURL() || 'assets/images/stream.jpg';

                    this.homey.app.log(`[Device] ${this.getName()} - Set image - `, imagePath);
                    const res = await fetch(imagePath);

                    if (!res.ok) throw new Error('Cannot fetch realtime image');

                    return res.body.pipe(stream);
                });
            }

            this.homey.app.log(`[Device] ${this.getName()} - Registering Device image`);

            this.setCameraImage(this.HomeyDevice.station_sn, this.getName(), this._image).catch(this.err);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async setParamStatus(capability, value) {
        try {
            await this.setCapabilityValue(capability, value);
            this.homey.app.log(`[Device] ${this.getName()} - setParamStatus ${capability} - to: `, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }
};
