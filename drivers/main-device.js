const Homey = require('homey');
const { CommandType } = require('eufy-node-client');
const eufyCommandSendHelper = require("../../lib/helpers/eufy-command-send.helper");

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        Homey.app.setDevices(this);

        this.registerCapabilityListener('onoff', this.onCapability_CMD_DEVS_SWITCH.bind(this));
        this.registerCapabilityListener('CMD_SET_ARMING', this.onCapability_CMD_SET_ARMING.bind(this));

        this.setAvailable();
        this.setCameraImage();
    }
    
    async onCapability_CMD_DEVS_SWITCH( value, opts ) {
        const deviceObject = this.getData();
        try {
            const deviceId = deviceObject.index || 0;
            const CMD_DEVS_SWITCH = value ? 1 : 0;

            await eufyCommandSendHelper.sendCommand(CommandType.CMD_DEVS_SWITCH, CMD_DEVS_SWITCH, deviceId, 'CMD_DEVS_SWITCH');
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }
    
    async onCapability_CMD_SET_ARMING( value, opts ) {
        try {
            const CMD_SET_ARMING = value;
            await eufyCommandSendHelper.sendCommand(CommandType.CMD_SET_ARMING, CMD_SET_ARMING, null, 'CMD_SET_ARMING');
            return Promise.resolve(true);
        } catch (e) {
            Homey.app.error(e);
            return Promise.reject(e);
        }
    }

    setCameraImage() {
        const deviceObject = this.getData();
        const _image = new Homey.Image();
        _image.setStream(async (stream) => {
            const res = await fetch(deviceObject.cover_path);
            if(!res.ok) throw new Error(res.statusText);
            res.body.pipe(stream);
        });
        _image.register()
            .then(() => image =>this.setCameraImage('camera', 'Last Event', image))
            .catch(this.error);
    }
}