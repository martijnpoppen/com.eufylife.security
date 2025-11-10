const Homey = require('homey');
const { ARM_TYPES } = require('../constants/capability_types');
const { sleep, imageExists, isNil, keyByValue, waitUntil } = require('../lib/utils.js');
const { PropertyName } = require('eufy-security-client');
const fs = require('fs');
const path = require('path');

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        await this.setupDevice();
    }

    async onStartup(initial = false, index) {
        try {
            const settings = this.getSettings();

            this.homey.app.debug(`[Device] ${this.getName()} - starting`);

            this.setUnavailable(`${this.getName()} ${this.homey.__('device.init')}`);

            await sleep((index + 1) * 1000);

            this.EufyDevice = await this.homey.app.eufyClient.getDevice(this.HomeyDevice.device_sn);
            this.HomeyDevice.station_sn = await this.EufyDevice.getStationSerial();
            this.EufyStation = await this.homey.app.eufyClient.getStation(this.HomeyDevice.station_sn);

            this.HomeyDevice.isStandAlone = this.HomeyDevice.device_sn === this.HomeyDevice.station_sn;
            this.EufyStation.rawStation.member.nick_name = 'Homey';
            this.HomeyDevice.isStandAloneBattery = this.HomeyDevice.isStandAlone && !!this.EufyDevice && this.EufyDevice.hasBattery();

            this.homey.app.log(
                `[Device] ${this.getName()} - starting - isStandAlone: ${this.HomeyDevice.isStandAlone} - isStandAloneBattery: ${this.HomeyDevice.isStandAloneBattery} - station_sn: ${
                    this.HomeyDevice.station_sn
                } - device_sn: ${this.HomeyDevice.device_sn}`
            );

            this.homey.app.setDevice(this);

            await this.setImage('snapshot');
            await this.setImage('event');

            if (this.homey.platformVersion === 2) {
                await this.setVideo();
            }

            if (initial) {
                await this.checkCapabilities();
                await this.resetCapabilities();

                await this.check_alarm_arm_mode(settings);
                await this.check_alarm_generic(settings);
                await this.check_alarm_motion(settings);

                await this.setCapabilitiesListeners();
            } else {
                await this.resetCapabilities();
            }

            await this.deviceParams(this, true);
            await this.setAvailable();

            const appSettings = this.homey.app.appSettings;
            const ipAddress = appSettings.STATION_IPS[this.HomeyDevice.station_sn] ? appSettings.STATION_IPS[this.HomeyDevice.station_sn] : this.EufyStation.getLANIPAddress();
            await this.setSettings({
                LOCAL_STATION_IP: ipAddress,
                STATION_SN: this.EufyStation.getSerial(),
                DEVICE_SN: this.EufyDevice.getSerial()
            });

            this._started = true;
        } catch (error) {
            this.setUnavailable(this.homey.__('device.serial_failure'));
            this.homey.app.error(error);
        }
    }

    async onAdded() {
        this.homey.app.log(`[Device] ${this.getName()} - onAdded`);

        this.onStartup(true);
    }

    onDeleted() {
        const deviceObject = this.getData();
        this.homey.app.removeDevice(deviceObject.device_sn);
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.homey.app.log(`[Device] ${this.getName()} - onSettings - Old/New`, oldSettings, newSettings);

        if (changedKeys.includes('alarm_generic_enabled')) {
            this.check_alarm_generic(newSettings);
        }

        if (changedKeys.includes('alarm_motion_enabled')) {
            this.check_alarm_motion(newSettings);
        }

        if (changedKeys.includes('alarm_arm_mode')) {
            this.check_alarm_arm_mode(newSettings);
        }

        if (changedKeys.includes('LOCAL_STATION_IP')) {
            let appSettings = this.homey.app.appSettings;
            appSettings.STATION_IPS[this.HomeyDevice.station_sn] = newSettings.LOCAL_STATION_IP;

            if (newSettings.LOCAL_STATION_IP === '') {
                delete appSettings.STATION_IPS[this.HomeyDevice.station_sn];
            }

            await this.homey.app.updateSettings(appSettings);

            this.homey.app.setEufyClient(this.homey.app.appSettings);
            return true;
        }
    }

    async setupDevice() {
        this.homey.app.debug(`[Device] - init => ${this.driver.id} - name: ${this.getName()}`);

        this.unsetWarning();
        this.setUnavailable(`${this.getName()} ${this.homey.__('device.init')}`);

        const deviceObject = this.getData();
        this.HomeyDevice = deviceObject;
        this.HomeyDevice.isStandAlone = this.HomeyDevice.device_sn === this.HomeyDevice.station_sn;
        this.HomeyDevice.isStandAloneBattery = false;
        // inital set of isStandAlone. Override in onStartup for cameras that can be used with Homebase's

        this._image = {
            snapshot: null,
            event: null
        };
        this._started = false;

        await sleep(9000);

        if (this.homey.app.needCaptcha) {
            this.setUnavailable(`${this.getName()} ${this.homey.__('device.need_captcha')}`);
        } else if (this.homey.app.need2FA) {
            this.setUnavailable(`${this.getName()} ${this.homey.__('device.need_2FA')}`);
        }
    }

    async resetCapabilities() {
        try {
            await this.resetCapability('alarm_motion');
            await this.resetCapability('alarm_contact');
            await this.resetCapability('alarm_generic');
            await this.resetCapability('alarm_arm_mode');
            await this.resetCapability('NTFY_MOTION_DETECTION');
            await this.resetCapability('NTFY_FACE_DETECTION');
            await this.resetCapability('NTFY_CRYING_DETECTED');
            await this.resetCapability('NTFY_SOUND_DETECTED');
            await this.resetCapability('NTFY_PET_DETECTED');
            await this.resetCapability('NTFY_VEHICLE_DETECTED');
            await this.resetCapability('NTFY_PRESS_DOORBELL');
            await this.resetCapability('NTFY_LOITERING_DETECTION');
        } catch (error) {
            this.homey.app.error(error);
        }
    }

    async resetCapability(name, value = false) {
        if (this.hasCapability(name)) {
            this.setCapabilityValue(name, value).catch(this.error);
        }
    }

    async checkCapabilities() {
        const driverManifest = this.driver.manifest;
        let driverCapabilities = driverManifest.capabilities;
        const deviceCapabilities = this.getCapabilities();

        this.homey.app.debug(`[Device] ${this.getName()} - checkCapabilities for`, driverManifest.id);
        this.homey.app.debug(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);

        if (!this.HomeyDevice.isStandAlone && (this.hasCapability('CMD_SET_ARMING') || driverCapabilities.includes('CMD_SET_ARMING'))) {
            const deleteCapabilities = ['CMD_SET_ARMING'];

            this.homey.app.log(`[Device] ${this.getName()} - checkCapabities - StandAlone device part of Homebase 3 (or 2 or Minibase Chime) - Removing: `, deleteCapabilities);

            driverCapabilities = driverCapabilities.filter((item) => !deleteCapabilities.includes(item));
        }

        // Check if Homebase NOT exists:
        if (!this.homey.app.deviceTypes.HOMEBASE_3.some((v) => this.HomeyDevice.station_sn.includes(v))) {
            let deleteCapabilities = this.hasCapability('NTFY_VEHICLE_DETECTED_FORCE') ? [] : ['NTFY_VEHICLE_DETECTED'];

            if (!this.HomeyDevice.isStandAlone) {
                deleteCapabilities = [...deleteCapabilities, 'NTFY_PET_DETECTED'];
            }

            this.homey.app.log(`[Device] ${this.getName()} - checkCapabities - Homebase 3 not found - Removing: `, deleteCapabilities);

            driverCapabilities = driverCapabilities.filter((item) => !deleteCapabilities.includes(item));
        }

        // Check if devices has a battery
        if (!!this.EufyDevice && this.EufyDevice.hasBattery()) {
            driverCapabilities = [...driverCapabilities, 'measure_battery', 'measure_temperature'];

            this.homey.app.log(`[Device] ${this.getName()} - checkCapabities - Battery found - Adding: `, ['measure_battery', 'measure_temperature']);
        }

        if (!!this.EufyDevice && this.hasCapability('NTFY_LOITERING_DETECTION') && !this.EufyDevice.hasProperty(PropertyName.DeviceLoiteringDetection)) {
            let deleteCapabilities = ['NTFY_LOITERING_DETECTION'];

            driverCapabilities = driverCapabilities.filter((item) => !deleteCapabilities.includes(item));
            this.homey.app.log(`[Device] ${this.getName()} - checkCapabities - No loitering - Removing: `, deleteCapabilities);
        }

        if (!!this.EufyDevice && !this.EufyDevice.hasProperty(PropertyName.DeviceLight)) {
            let deleteCapabilities = ['CMD_SET_FLOODLIGHT_MANUAL_SWITCH'];

            driverCapabilities = driverCapabilities.filter((item) => !deleteCapabilities.includes(item));
            this.homey.app.log(`[Device] ${this.getName()} - checkCapabities - No floodlight - Removing: `, deleteCapabilities);
        }

        await this.updateCapabilities(driverCapabilities, deviceCapabilities);

        return;
    }

    async updateCapabilities(driverCapabilities, deviceCapabilities) {
        try {
            const newC = driverCapabilities.filter((d) => !deviceCapabilities.includes(d));
            const oldC = deviceCapabilities.filter((d) => !driverCapabilities.includes(d));

            this.homey.app.debug(`[Device] ${this.getName()} - Got old capabilities =>`, oldC);
            this.homey.app.debug(`[Device] ${this.getName()} - Got new capabilities =>`, newC);

            oldC.forEach((c) => {
                this.homey.app.log(`[Device] ${this.getName()} - updateCapabilities => Remove `, c);
                this.removeCapability(c).catch((e) => this.homey.app.log(e));
            });
            await sleep(2000);
            newC.forEach((c) => {
                this.homey.app.log(`[Device] ${this.getName()} - updateCapabilities => Add `, c);
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            this.homey.app.error(error);
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
        } catch (error) {
            this.homey.app.error(error);
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

    async onCapability_CMD_SET_ARMING(value, triggerByFlow = false) {
        try {
            let CMD_SET_ARMING = ARM_TYPES[value];

            if (CMD_SET_ARMING == '6') {
                throw new Error('Not available for this device');
            }

            this.EufyStation.rawStation.member.nick_name = 'Homey';

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING - triggerByFlow`, triggerByFlow);
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_ARMING - `, value, CMD_SET_ARMING);
            await this.homey.app.eufyClient.setStationProperty(this.HomeyDevice.station_sn, PropertyName.StationGuardMode, CMD_SET_ARMING);

            await this.set_alarm_arm_mode(value);

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

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DOORBELL_QUICK_RESPONSE - voices: `, voices);

            if (voices && Object.keys(voices).length >= value) {
                const currentVoice = Object.keys(voices)[value - 1];

                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DOORBELL_QUICK_RESPONSE - trigger voice`, parseInt(currentVoice));

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
        }
    }

    async onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceVideoStreamingQuality, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_IRCUT_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_IRCUT_SWITCH - `, value);

            if (this.EufyDevice.hasProperty(PropertyName.DeviceNightvision)) {
                await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceNightvision, value);
            } else {
                await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceAutoNightvision, value);
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_MOTION_TRACKING(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_MOTION_TRACKING - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceMotionTracking, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_SET_SNOOZE_MODE(homebase = 0, motion = 0, snooze = 0, chime = 0) {
        const payload = {
            snooze_homebase: !!parseInt(homebase),
            snooze_motion: !!parseInt(motion),
            snooze_chime: !!parseInt(chime),
            snooze_time: parseInt(snooze)
        };

        this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_SNOOZE_MODE - `, payload);
        await this.EufyStation.snooze(this.EufyDevice, payload);
    }

    async onCapability_CMD_TRIGGER_ALARM(time) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, time);

            if (this.HomeyDevice.isStandAlone) {
                await this.EufyStation.triggerStationAlarmSound(time + 2);
                // time + 2 so we can disable alarm manually.

                // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
                await sleep(time * 1000);

                await this.EufyStation.triggerStationAlarmSound(0);
            } else {
                await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, time + 2);
                // time + 2 so we can disable alarm manually.

                // wait for alarm to be finished. turn off to have a off notification. So the alarm_generic will notify
                await sleep(time * 1000);

                await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, 0);
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_HUB_ALARM_CLOSE() {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_TRIGGER_ALARM - `, 0);

            if (this.HomeyDevice.isStandAlone) {
                await this.EufyStation.triggerStationAlarmSound(0);
            } else {
                await this.EufyStation.triggerDeviceAlarmSound(this.EufyDevice, 0);
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH - `, value);
            await this.setCapabilityValue('CMD_SET_FLOODLIGHT_MANUAL_SWITCH', value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceLight, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_DEV_LED_SWITCH(value) {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_DEV_LED_SWITCH - `, value);
            await this.homey.app.eufyClient.setDeviceProperty(this.HomeyDevice.device_sn, PropertyName.DeviceStatusLed, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async onCapability_CMD_STOP_STREAM() {
        try {
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_STOP_STREAM => Check if stream is running`);

            if (this.homey.app.FfmpegManager.isRunning || this.EufyStation.isLiveStreaming(this.EufyDevice)) {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_STOP_STREAM => Closing existing stream`);
                await this.homey.app.FfmpegManager.stopStream();
                await this.homey.app.eufyClient.stopStationLivestream(this.HomeyDevice.device_sn);
            } else {
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_CMD_STOP_STREAM => No existing stream`);
            }
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_START_LIVESTREAM(type) {
        try {
            const deviceEnabled = await this.EufyDevice.getPropertyValue(PropertyName.DeviceEnabled);
            const snapshotTime = this.HomeyDevice.isStandAloneBattery ? 4 : 5;
            const streamTime = 300;
            const isSnapshot = type === 'snapshot';
            const isVideo = type === 'video';

            if (!isSnapshot && !isVideo) {
                throw new Error(`Type: ${type} not allowed`);
            }

            // --- Start checks ---
            this.homey.app.log(`[Device] ${this.getName()} - onCapability_START_LIVESTREAM => Type`, type);

            if (!isSnapshot && !isVideo) {
                throw new Error(`Type: ${type} not allowed`);
            }

            if (isNil(deviceEnabled) || deviceEnabled === false) {
                throw new Error('Camera is off');
            }
            // --- End checks ---
            // --- Stop old stream ---

            await this.onCapability_CMD_STOP_STREAM();

            // --- End of Stop old stream ---
            // --- Start new stream ---
            let time = isSnapshot ? snapshotTime : streamTime;

            this.homey.app.log(`[Device] ${this.getName()} - onCapability_START_LIVESTREAM => Set Time`, time);

            await this.homey.app.eufyClient.setCameraMaxLivestreamDuration(time);
            await this.homey.app.eufyClient.startStationLivestream(this.HomeyDevice.device_sn);

            const status = await waitUntil(() => this.EufyStation.isLiveStreaming(this.EufyDevice), type);

            if (isSnapshot) {
                await sleep((time + 1) * 1000);

                this.homey.app.log(`[Device] ${this.getName()} - onCapability_START_LIVESTREAM => Updating device ${type} image`);

                await this.updateImage(type, this.HomeyDevice.device_sn);
            }

            return Promise.resolve(status);
            // --- End of Start new stream ---
        } catch (e) {
            this.homey.app.error(e);
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
                    if (typeof value === 'string') {
                        await this.setCapabilityValue(message, value).catch(this.error);
                    } else {
                        await this.setCapabilityValue(message, true).catch(this.error);
                    }

                    if (setMotionAlarm) {
                        await this.setCapabilityValue('alarm_motion', true).catch(this.error);
                    }
                } else {
                    await this.setCapabilityValue(message, value).catch(this.error);
                    await this.set_alarm_arm_mode(value);
                }

                // check if boolean value
                if (typeof value === 'boolean') {
                    this.startTimeout(message, isNormalEvent, setMotionAlarm);
                }
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async startTimeout(message, isNormalEvent, setMotionAlarm) {
        await sleep(5000);

        if (isNormalEvent) {
            this.setCapabilityValue(message, false).catch(this.error);

            if (setMotionAlarm) {
                await sleep(5000);
                this.setCapabilityValue('alarm_motion', false).catch(this.error);
            }
        }
    }

    async setImage(imageType) {
        try {
            this.unsetWarning();

            if (!this._image[imageType]) {
                this._image[imageType] = await this.homey.images.createImage();

                this.homey.app.debug(`[Device] ${this.getName()} - Registering ${imageType} image`);

                const imageMap = [
                    {
                        type: 'event',
                        name: 'Event',
                        id: this.HomeyDevice.station_sn
                    },
                    {
                        type: 'snapshot',
                        name: 'Snapshot',
                        id: `${this.HomeyDevice.device_sn}-Snapshot`
                    }
                ];

                const imageFind = imageMap.find((x) => x.type === imageType);
                const imageID = imageFind.id;
                const imageName = imageFind.name;

                await this.updateImage(imageType, this.HomeyDevice.device_sn);

                this.setCameraImage(imageID, `${this.getName()} - ${imageName}`, this._image[imageType]).catch((err) => this.homey.app.error(err));
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async updateImage(imageType, deviceSn) {
        try {
            console.log(`[Device] ${this.getName()} - updateImage called`, imageType, deviceSn);

            const userDataPath = path.resolve(__dirname, '/userdata/');
            const savePath = path.join(userDataPath, `${deviceSn}_${imageType}.jpg`);

            this.homey.app.log(`[Device] ${this.getName()} - updateImage - Saving ${imageType} image to path: `, savePath);

            await imageExists(savePath, this.homey.app.log);

            await this._image[imageType].setPath(savePath);
            await this._image[imageType].update();

            this.homey.app.log(`[Device] ${this.getName()} - updateImage - ${imageType} image saved successfully`);
        } catch (error) {
            this.homey.app.error(`[Device] ${this.getName()} - updateImage - Error saving ${imageType} image:`, error);
        }
    }

    async getLocalAddress() {
        const host = await this.homey.cloud.getLocalAddress();
        const address = `${host.split(':')[0]}`;

        this.homey.app.log(`[Device] ${this.getName()} - getLocalAddress -`, address);

        return address;
    }

    async setVideo() {
        try {
            const isRTSPDevice = this.EufyDevice.hasProperty(PropertyName.DeviceRTSPStream);

            if (!isRTSPDevice) {
                this.homey.app.log(`[Device] ${this.getName()} - setvideo - device doesnt support native RTSP. Disabling video until FFMPEG RTSP works`, { isRTSPDevice });
                return;
            }
            const video = await this.homey.videos.createVideoRTSP();

            video.registerVideoUrlListener(async () => {
                const isRTSPDeviceEnabled = !!this.EufyDevice.isRTSPStreamEnabled();
                const isRTSPDevice = this.EufyDevice.hasProperty(PropertyName.DeviceRTSPStream);

                this.homey.app.log(`[Device] ${this.getName()} - setVideo registerVideoUrlListener -`, isRTSPDeviceEnabled ? 'native' : 'ffmpeg', { isRTSPDevice, isRTSPDeviceEnabled });
                // if (!isRTSPDevice && !this.EufyStation.isLiveStreaming(this.EufyDevice)) {
                //     await this.onCapability_START_LIVESTREAM('video');
                //     await sleep(7500);
                // }

                if (isRTSPDeviceEnabled) {
                    await this.EufyStation.startRTSPStream(this.EufyDevice);
                    const url = await this.EufyDevice.getPropertyValue(PropertyName.DeviceRTSPStreamUrl);
                    this.homey.app.log(`[Device] ${this.getName()} - setvideo registerVideoUrlListener - request url for native RTSP`, url);
                    return { url };
                }

                // check if device is off
                if (!this.getCapabilityValue('onoff')) {
                    const url = 'Camera_is_off';
                    return {
                        url
                    };
                }

                // const localAddress = await this.getLocalAddress();
                // const url = `rtsp://${localAddress}:${this.homey.app.streamPort}/${this.homey.manifest.id}/${this.HomeyDevice.device_sn}`;
                // this.homey.app.log(`[Device] ${this.getName()} - setvideo - request url for ffmpeg RTSP`, url);
                const url = 'RTSP_not_enabled_in_EUFY_app';
                return {
                    url
                };
            });

            await this.setCameraVideo('main', 'Live', video);
        } catch (err) {
            this.homey.app.error(err);
        }
    }

    async deviceParams(ctx, initial = false) {
        try {
            // will be called from event helper
            const settings = ctx.getSettings();

            if (initial && ctx.EufyDevice && ctx.hasCapability('measure_battery')) {
                ctx.homey.app.debug(`[Device] ${ctx.getName()} - deviceParams - measure_battery`);
                const value = ctx.EufyDevice.getPropertyValue(PropertyName.DeviceBattery);
                if (!isNil(value)) ctx.setParamStatus('measure_battery', value);
            }

            if (initial && ctx.EufyDevice && ctx.hasCapability('measure_temperature')) {
                ctx.homey.app.debug(`[Device] ${ctx.getName()} - deviceParams - measure_temperature`);
                const value = ctx.EufyDevice.getPropertyValue(PropertyName.DeviceBatteryTemp);
                if (!isNil(value)) ctx.setParamStatus('measure_temperature', value);
            }

            if (initial && ctx.EufyDevice && ctx.hasCapability('onoff')) {
                ctx.homey.app.debug(`[Device] ${ctx.getName()} - deviceParams - onoff`);
                const value = ctx.EufyDevice.getPropertyValue(PropertyName.DeviceEnabled);
                if (!isNil(value)) ctx.setParamStatus('onoff', value);
            }

            if (initial && ctx.EufyStation && ctx.hasCapability('CMD_SET_ARMING')) {
                const value = ctx.EufyStation.getPropertyValue(PropertyName.StationGuardMode);
                ctx.homey.app.debug(`[Device] ${ctx.getName()} - deviceParams - StationGuardMode`, value);
                let CMD_SET_ARMING = keyByValue(ARM_TYPES, parseInt(value));
                if (!isNil(CMD_SET_ARMING)) {
                    ctx.setParamStatus('CMD_SET_ARMING', CMD_SET_ARMING);
                    this.set_alarm_arm_mode(CMD_SET_ARMING);
                }
            }

            if (settings.force_include_thumbnail && ctx.EufyDevice && ctx.EufyDevice.hasProperty(PropertyName.DeviceNotificationType)) {
                ctx.homey.app.debug(`[Device] ${ctx.getName()} - enforceSettings - DeviceNotificationType`);

                await ctx.homey.app.eufyClient.setDeviceProperty(settings.DEVICE_SN, PropertyName.DeviceNotificationType, 2).catch((e) => ctx.log(e));
            }
        } catch (e) {
            ctx.homey.app.error(e);
        }
    }

    async setParamStatus(capability, value) {
        try {
            await this.setCapabilityValue(capability, value).catch(this.error);
            this.homey.app.debug(`[Device] ${this.getName()} - setParamStatus ${capability} - to: `, value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
        }
    }

    async set_alarm_arm_mode(value) {
        if (this.hasCapability('alarm_arm_mode')) {
            const settings = this.getSettings();

            if (settings.alarm_arm_mode && settings.alarm_arm_mode !== 'disabled') {
                const modes = settings.alarm_arm_mode.split('_');

                const values = modes.map((x) => x.replace('-', '_'));

                this.homey.app.debug(`[Device] ${this.getName()} - set_alarm_arm_mode: ${settings.alarm_arm_mode} - value: `, value, values.includes(value));

                await this.setCapabilityValue('alarm_arm_mode', values.includes(value)).catch(this.error);
            } else {
                this.homey.app.debug(`[Device] ${this.getName()} - set_alarm_arm_mode: ${settings.alarm_arm_mode}`, false);

                await this.setCapabilityValue('alarm_arm_mode', false).catch(this.error);
            }
        }
    }

    async check_alarm_arm_mode(settings) {
        if (settings.alarm_arm_mode === 'disabled' && this.hasCapability('alarm_arm_mode')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_arm_mode: removing alarm_arm_mode`);
            this.removeCapability('alarm_arm_mode').catch((e) => this.homey.app.log(e));
        } else if (!!settings.alarm_arm_mode && !this.hasCapability('alarm_arm_mode')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_arm_mode: adding alarm_arm_mode`);
            this.addCapability('alarm_arm_mode').catch((e) => this.homey.app.log(e));
        }
    }

    async check_alarm_motion(settings) {
        if ('alarm_motion_enabled' in settings && !settings.alarm_motion_enabled && this.hasCapability('alarm_motion')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_motion: removing alarm_motion`);
            this.removeCapability('alarm_motion').catch((e) => this.homey.app.log(e));
        } else if ('alarm_motion_enabled' in settings && !!settings.alarm_motion_enabled && !this.hasCapability('alarm_motion')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_motion: adding alarm_motion`);
            this.addCapability('alarm_motion').catch((e) => this.homey.app.log(e));
        }
    }

    async check_alarm_generic(settings) {
        if ('alarm_generic_enabled' in settings && !settings.alarm_generic_enabled && this.hasCapability('alarm_generic')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_generic: removing alarm_generic`);
            this.removeCapability('alarm_generic').catch((e) => this.homey.app.log(e));
        } else if ('alarm_generic_enabled' in settings && !!settings.alarm_generic_enabled && !this.hasCapability('alarm_generic')) {
            this.homey.app.debug(`[Device] ${this.getName()} - check_alarm_generic: adding alarm_generic`);
            this.addCapability('alarm_generic').catch((e) => this.homey.app.log(e));
        }
    }
};
