"use strict";

const mainDriver = require('./main-driver');

module.exports = class mainHubDriver extends mainDriver {
    driverType() {
        return 'stations';
    }

    // ---------------------------------------AUTO COMPLETE HELPERS----------------------------------------------------------
    async onDeviceListRequest(driverId) {
        try {
            const deviceType = this.deviceType();

            const deviceList = await this.homey.app.deviceList;
            const pairedDevicesArray = [];

            deviceList.forEach((device) => {
                const data = device.getData();

                pairedDevicesArray.push(data.device_sn);
            });

            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - pairedDevicesArray`, pairedDevicesArray);

            const results = this.deviceList
                .filter((device) => !pairedDevicesArray.includes(device.rawStation.station_sn))
                .filter((device) => deviceType.some((v) => device.rawStation.station_sn.includes(v)))
                .map((d, i) => ({
                    name: d.rawStation.station_name,
                    data: {
                        name: d.rawStation.station_name,
                        index: i,
                        id: `${d.rawStation.station_sn}-${d.rawStation.station_id}`,
                        station_sn: d.rawStation.station_sn,
                        device_sn: d.rawStation.station_sn
                    },
                    settings: { STATION_SN: d.rawStation.station_sn }
                }));

            this.homey.app.log(`[Driver] [onDeviceListRequest] ${driverId} - Found devices - `, results);

            return Promise.resolve(results);
        } catch (e) {
            this.homey.app.error('Error when trying to connect new device', e);

            if (typeof e === 'object') {
                return Promise.reject(JSON.stringify(e));
            }
        }
    }
};
