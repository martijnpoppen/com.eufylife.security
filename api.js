"use strict";

const Homey = require('homey');

module.exports = [
    {
        method:         'PUT',
        path:            '/settings',
        fn: function( args, callback ){
            var result = Homey.app.updateSettings( args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

]

