const Homey = require('homey');

module.exports = class device_EUFYCAM_2C_PRO extends Homey.Device {

	onInit() {
		Homey.app.log('[Device] - init =>', this.getName());
        const deviceObject = this.getData();
        Homey.app.setDevices(deviceObject);
	}
}