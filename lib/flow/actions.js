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

        Homey.app.action_CMD_DOORBELL_QUICK_RESPONSE = new Homey.FlowCardAction('action_CMD_DOORBELL_QUICK_RESPONSE')
        .registerRunListener( async ( args, state ) =>
       {
           await args.device.onCapability_CMD_DOORBELL_QUICK_RESPONSE( args.action_CMD_SET_QUICK_RESPONSE_TYPE, null );
           return await args.device.setCapabilityValue( 'CMD_DOORBELL_QUICK_RESPONSE', args.action_CMD_SET_QUICK_RESPONSE_TYPE);
       } )
       .register();

       Homey.app.action_CMD_START_STREAM = new Homey.FlowCardAction('action_CMD_START_STREAM')
       .registerRunListener( async ( args, state ) =>
      {
        return await args.device.onCapability_CMD_START_STOP_STREAM(true);
      } )
      .register();

      Homey.app.action_CMS_STOP_STREAM = new Homey.FlowCardAction('action_CMD_STOP_STREAM')
      .registerRunListener( async ( args, state ) =>
     {
       return await args.device.onCapability_CMD_START_STOP_STREAM(false);
     } )
     .register();
    } catch (err) {
        Homey.app.error(err);
    }
}   


// ---------------------------------------END OF FILE----------------------------------------------------------