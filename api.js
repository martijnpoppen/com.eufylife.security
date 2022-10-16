module.exports = {
    async login({ homey, body }){
        return homey.app.eufyLogin( body );
    },

    async settings({ homey, body }){
        return homey.app.updateSettings( body );
    },

    async streamUrl({homey, query}) {
        return await homey.app.getStreamUrl(query.device_sn);
    }
};