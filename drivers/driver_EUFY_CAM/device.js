const Homey = require('homey');

module.exports = class device_EUFY_CAM extends Homey.Device {

	onInit() {
		Homey.app.log('[Device] - init');
		Homey.app.log('[Device] - Name:', this.getName());
        Homey.app.log('[Device] - Class:', this.getClass());
	}
}