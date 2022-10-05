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
          .registerRunListener( async ( args, state ) => {
            await args.device.onCapability_CMD_DOORBELL_QUICK_RESPONSE( args.action_CMD_SET_QUICK_RESPONSE_TYPE );
            return await args.device.setCapabilityValue( 'CMD_DOORBELL_QUICK_RESPONSE', args.action_CMD_SET_QUICK_RESPONSE_TYPE);
          })
          .register();

       Homey.app.action_CMD_START_STREAM = new Homey.FlowCardAction('action_CMD_START_STREAM')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_START_STOP_STREAM(true);
        })
        .register();

        Homey.app.action_CMD_START_STREAM = new Homey.FlowCardAction('action_CMD_START_STREAM_HLS_RTMP')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_START_STOP_STREAM(args.action_CMD_START_STREAM_TYPE);
        })
        .register();


      Homey.app.action_CMS_STOP_STREAM = new Homey.FlowCardAction('action_CMD_STOP_STREAM')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_START_STOP_STREAM(false);
        })
        .register();

      Homey.app.action_CMD_REBOOT_HUB = new Homey.FlowCardAction('action_CMD_REBOOT_HUB')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_REBOOT_HUB();
        })
        .register();

      Homey.app.action_CMD_TRIGGER_ALARM = new Homey.FlowCardAction('action_CMD_TRIGGER_ALARM')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_TRIGGER_ALARM( parseInt(args.action_CMD_TRIGGER_ALARM_TIME) );
        })
        .register();

      Homey.app.action_CMD_SET_HUB_ALARM_CLOSE = new Homey.FlowCardAction('action_CMD_SET_HUB_ALARM_CLOSE')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_SET_HUB_ALARM_CLOSE();
        })
        .register(); 

        Homey.app.action_CMD_BAT_DOORBELL_WDR_SWITCH = new Homey.FlowCardAction('action_CMD_BAT_DOORBELL_WDR_SWITCH')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_BAT_DOORBELL_WDR_SWITCH(args.action_CMD_BAT_DOORBELL_WDR_SWITCH_TYPE);
        })
        .register(); 

        Homey.app.action_CMD_BAT_DOORBELL_VIDEO_QUALITY = new Homey.FlowCardAction('action_CMD_BAT_DOORBELL_VIDEO_QUALITY')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY(args.action_CMD_BAT_DOORBELL_VIDEO_QUALITY_TYPE);
        })
        .register(); 

        Homey.app.action_CMD_IRCUT_SWITCH = new Homey.FlowCardAction('action_CMD_IRCUT_SWITCH')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_IRCUT_SWITCH(args.action_CMD_IRCUT_SWITCH_TYPE);
        })
        .register(); 

        Homey.app.action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH = new Homey.FlowCardAction('action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH(args.action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH_TYPE);
        })
        .register(); 

        Homey.app.action_CMD_DEV_LED_SWITCH = new Homey.FlowCardAction('action_CMD_DEV_LED_SWITCH')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_DEV_LED_SWITCH(args.action_CMD_DEV_LED_SWITCH_TYPE);
        })
        .register(); 

        Homey.app.action_CMD_INDOOR_PAN_TURN = new Homey.FlowCardAction('action_CMD_INDOOR_PAN_TURN')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_INDOOR_PAN_TURN();
        })
        .register();

        Homey.app.action_CMD_INDOOR_PAN_TURN = new Homey.FlowCardAction('action_CMD_INDOOR_PAN_TURN_PTZ')
        .registerRunListener( async ( args, state ) => {
          return await args.device.onCapability_CMD_INDOOR_PAN_TURN(args.action_CMD_INDOOR_PAN_TURN_PTZ_TYPE, args.repeat);
        })
        .register();

        Homey.app.action_CMD_SET_SNOOZE_MODE = new Homey.FlowCardAction('action_CMD_SET_SNOOZE_MODE')
        .registerRunListener( async ( args, state ) => {
          const { device, homebase, motion, snooze} = args;
          return await device.onCapability_CMD_SET_SNOOZE_MODE(0, 0, snooze);
        })
        .register();

        Homey.app.action_CMD_SET_SNOOZE_MODE_HOMEBASE = new Homey.FlowCardAction('action_CMD_SET_SNOOZE_MODE_HOMEBASE')
        .registerRunListener( async ( args, state ) => {
          const { device, homebase, motion, snooze } = args;
          return await device.onCapability_CMD_SET_SNOOZE_MODE(homebase, motion, snooze);
        })
        .register();

        Homey.app.action_CMD_SET_SNOOZE_MODE_CHIME = new Homey.FlowCardAction('action_CMD_SET_SNOOZE_MODE_CHIME')
        .registerRunListener( async ( args, state ) => {
          const { device, motion, chime, snooze } = args;
          return await device.onCapability_CMD_SET_SNOOZE_MODE(0, motion, snooze, chime);
        })
        .register();
  } catch (err) {
      Homey.app.error(err);
  }
}   


// ---------------------------------------END OF FILE----------------------------------------------------------