// ---------------------------------------INIT FUNCTION----------------------------------------------------------

exports.init = async function (homey) {
    try {
        homey.app.action_CMD_SET_ARMING = homey.flow.getActionCard('action_CMD_SET_ARMING');
        homey.app.action_CMD_SET_ARMING.registerRunListener(async (args, state) => {
            await args.device.onCapability_CMD_SET_ARMING(args.action_CMD_SET_ARM_TYPE, null);
            return await args.device.setCapabilityValue('CMD_SET_ARMING', args.action_CMD_SET_ARM_TYPE);
        });

        homey.app.action_CMD_DOORBELL_QUICK_RESPONSE = homey.flow.getActionCard('action_CMD_DOORBELL_QUICK_RESPONSE');
        homey.app.action_CMD_DOORBELL_QUICK_RESPONSE.registerRunListener(async (args, state) => {
            await args.device.onCapability_CMD_DOORBELL_QUICK_RESPONSE(args.action_CMD_SET_QUICK_RESPONSE_TYPE);
            return await args.device.setCapabilityValue('CMD_DOORBELL_QUICK_RESPONSE', args.action_CMD_SET_QUICK_RESPONSE_TYPE);
        });

        homey.app.action_CMD_TRIGGER_RINGTONE_HUB = homey.flow.getActionCard('action_CMD_TRIGGER_RINGTONE_HUB');
        homey.app.action_CMD_TRIGGER_RINGTONE_HUB.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_TRIGGER_RINGTONE_HUB(args.action_CMD_TRIGGER_RINGTONE_HUB_TYPE);
        });

        homey.app.action_CMD_START_STREAM = homey.flow.getActionCard('action_CMD_START_STREAM');
        homey.app.action_CMD_START_STREAM.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_START_STOP_STREAM(true);
        });

        homey.app.action_CMD_START_STREAM = homey.flow.getActionCard('action_CMD_START_STREAM_HLS_RTMP');
        homey.app.action_CMD_START_STREAM.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_START_STOP_STREAM(args.action_CMD_START_STREAM_TYPE);
        });

        homey.app.action_CMS_STOP_STREAM = homey.flow.getActionCard('action_CMD_STOP_STREAM');
        homey.app.action_CMS_STOP_STREAM.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_START_STOP_STREAM(false);
        });

        homey.app.action_CMD_REBOOT_HUB = homey.flow.getActionCard('action_CMD_REBOOT_HUB');
        homey.app.action_CMD_REBOOT_HUB.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_REBOOT_HUB();
        });

        homey.app.action_CMD_TRIGGER_ALARM = homey.flow.getActionCard('action_CMD_TRIGGER_ALARM');
        homey.app.action_CMD_TRIGGER_ALARM.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_TRIGGER_ALARM(parseInt(args.action_CMD_TRIGGER_ALARM_TIME));
        });

        homey.app.action_CMD_SET_HUB_ALARM_CLOSE = homey.flow.getActionCard('action_CMD_SET_HUB_ALARM_CLOSE');
        homey.app.action_CMD_SET_HUB_ALARM_CLOSE.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_SET_HUB_ALARM_CLOSE();
        });

        homey.app.action_CMD_BAT_DOORBELL_WDR_SWITCH = homey.flow.getActionCard('action_CMD_BAT_DOORBELL_WDR_SWITCH');
        homey.app.action_CMD_BAT_DOORBELL_WDR_SWITCH.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_BAT_DOORBELL_WDR_SWITCH(!!parseInt(args.action_CMD_BAT_DOORBELL_WDR_SWITCH_TYPE));
        });

        homey.app.action_CMD_BAT_DOORBELL_VIDEO_QUALITY = homey.flow.getActionCard('action_CMD_BAT_DOORBELL_VIDEO_QUALITY');
        homey.app.action_CMD_BAT_DOORBELL_VIDEO_QUALITY.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_BAT_DOORBELL_VIDEO_QUALITY(args.action_CMD_BAT_DOORBELL_VIDEO_QUALITY_TYPE);
        });

        homey.app.action_CMD_IRCUT_SWITCH = homey.flow.getActionCard('action_CMD_IRCUT_SWITCH');
        homey.app.action_CMD_IRCUT_SWITCH.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_IRCUT_SWITCH(!!parseInt(args.action_CMD_IRCUT_SWITCH_TYPE));
        });

        homey.app.action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH = homey.flow.getActionCard('action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH');
        homey.app.action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_SET_FLOODLIGHT_MANUAL_SWITCH(args.action_CMD_SET_FLOODLIGHT_MANUAL_SWITCH_TYPE);
        });

        homey.app.action_CMD_DEV_LED_SWITCH = homey.flow.getActionCard('action_CMD_DEV_LED_SWITCH');
        homey.app.action_CMD_DEV_LED_SWITCH.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_DEV_LED_SWITCH(args.action_CMD_DEV_LED_SWITCH_TYPE);
        });

        homey.app.action_CMD_INDOOR_PAN_TURN = homey.flow.getActionCard('action_CMD_INDOOR_PAN_TURN');
        homey.app.action_CMD_INDOOR_PAN_TURN.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_INDOOR_PAN_TURN();
        });

        homey.app.action_CMD_INDOOR_PAN_TURN = homey.flow.getActionCard('action_CMD_INDOOR_PAN_TURN_PTZ');
        homey.app.action_CMD_INDOOR_PAN_TURN.registerRunListener(async (args, state) => {
            return await args.device.onCapability_CMD_INDOOR_PAN_TURN(args.action_CMD_INDOOR_PAN_TURN_PTZ_TYPE, args.repeat);
        });

        homey.app.action_CMD_SET_SNOOZE_MODE = homey.flow.getActionCard('action_CMD_SET_SNOOZE_MODE');
        homey.app.action_CMD_SET_SNOOZE_MODE.registerRunListener(async (args, state) => {
            const { device, homebase, motion, snooze } = args;
            return await device.onCapability_CMD_SET_SNOOZE_MODE(0, 0, snooze);
        });

        homey.app.action_CMD_SET_SNOOZE_MODE_HOMEBASE = homey.flow.getActionCard('action_CMD_SET_SNOOZE_MODE_HOMEBASE');
        homey.app.action_CMD_SET_SNOOZE_MODE_HOMEBASE.registerRunListener(async (args, state) => {
            const { device, homebase, motion, snooze } = args;
            return await device.onCapability_CMD_SET_SNOOZE_MODE(homebase, motion, snooze);
        });

        homey.app.action_CMD_SET_SNOOZE_MODE_CHIME = homey.flow.getActionCard('action_CMD_SET_SNOOZE_MODE_CHIME');
        homey.app.action_CMD_SET_SNOOZE_MODE_CHIME.registerRunListener(async (args, state) => {
            const { device, motion, chime, snooze } = args;
            return await device.onCapability_CMD_SET_SNOOZE_MODE(0, motion, snooze, chime);
        });
    } catch (err) {
        homey.app.error(err);
    }
};

// ---------------------------------------END OF FILE----------------------------------------------------------
