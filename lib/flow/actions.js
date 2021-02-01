const Homey = require('homey');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function () {
    try {
        Homey.app.action_CMD_SET_ARMING = new Homey.FlowCardAction('action_CMD_SET_ARMING')
         .registerRunListener( async ( args, state ) =>
        {
            await args.device.onCapability_CMD_SET_ARMING( args.action_CMD_SET_ARM_TYPE, null );
            return await args.device.setCapabilityValue( 'CMD_SET_ARMING', args.action_CMD_SET_ARM_TYPE);
        } )
        .register();

    } catch (err) {
        Homey.app.error(err);
    }
}   


// ---------------------------------------END OF FILE----------------------------------------------------------