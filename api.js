'use strict';

const Homey = require('homey');

module.exports = [
    {
        method: 'PUT',
        path: '/login',
        fn: async function (args, callback) {
            const result = await Homey.app.eufyLogin(args.body);
            if (result instanceof Error) return callback(result);
            return callback(null, result);
        }
    },
    {
        method: 'PUT',
        path: '/settings',
        fn: async function (args, callback) {
            const result = Homey.app.updateSettings(args.body);
            if (result instanceof Error) return callback(result);
            return callback(null, result);
        }
    }
];
