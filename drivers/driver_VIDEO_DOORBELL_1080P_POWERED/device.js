const Homey = require('homey');

module.exports = class device_VIDEO_DOORBELL_1080P_POWERED extends Homey.Device {

	onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        const deviceObject = this.getData();
        Homey.app.setDevices(deviceObject);
	}
}