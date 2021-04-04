const Homey = require("homey");
const { CommandType } = require('eufy-node-client');

const ManagerCron = Homey.ManagerCron;

const _schedules =  {
    EVERY_MINUTE: "* * * * *",
    EVERY_FIVE_MINUTE: "*/5 * * * *",
    EVERY_TWO_HOURS: "0 */2 * * *",
    EVERY_FOUR_HOURS: "0 */4 * * *"
};

// ---------------------------------------EUFY HELPERS----------------------------------------------------------

exports.getParamData = function (params, param_type) {
    const parameter = params.find(p => p.param_type === CommandType[param_type]);
    if(parameter) {
        return parseInt(parameter.param_value);
    }

    return null;
}

exports.registerCronTask = async function(id, timing, callback) {
    const schedule = _schedules[timing];
    Homey.app.log(id + " @ '" + schedule + "' --> " + callback.name);
    let task = await ManagerCron.registerTask(id, schedule, {});
    task.on('run', data => {
        callback();
    });
}

// ---------------------------------------END OF FILE----------------------------------------------------------