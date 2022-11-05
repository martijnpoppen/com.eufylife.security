module.exports = {
    async streamUrl({homey, query}) {
        return await homey.app.getStreamUrl(query.device_sn);
    }
};