const Homey = require('homey');

// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function () {
    try {
        Homey.app.condition_CHECK_ARMING = new Homey.FlowCardCondition('condition_CHECK_ARMING')
         .registerRunListener( async ( args, state ) =>
        {
            const value = args.condition_CHECK_ARM_TYPE;
            return await args.device.getCapabilityValue('CMD_SET_ARMING') == value.toString();
        } )
        .register();

    } catch (err) {
        Homey.app.error(err);
    }
}   


// ---------------------------------------END OF FILE----------------------------------------------------------
