const util = require('util');

const createNew = (ctxPath, debugEnabled = false, log_file = null) => {
    const fullMessage = (message) => `[${ctxPath}] ${message}`;
    const logFunctions = {
        debug(message, args) {
            if(debugEnabled) {
                if (args) {
                    log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                    console.info(fullMessage(message), args);
                } else {
                    log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                    console.info(fullMessage(message));
                }
            } else {
                if (args) {
                    log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                } else {
                    log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                }
            }
           
        },
        success(message, args) {
            if (args) {
                log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                console.log(fullMessage(message), args);
            } else {
                log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                console.log(fullMessage(message));
            }
        },
        info(message, args) {
            if (args) {
                log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                console.info(fullMessage(message), args);
            } else {
                log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                console.info(fullMessage(message));
            }
        },
        warn(message, args) {
            if (args) {
                log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                console.warn(fullMessage(message), args);
            } else {
                log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                console.warn(fullMessage(message));
            }
        },
        error(message, args) {
            if (args) {
                log_file && log_file.write(util.format(fullMessage(message), args) + '\n');
                console.error(fullMessage(message), args);
            } else {
                log_file && log_file.write(util.format(fullMessage(message)) + '\n');
                console.error(fullMessage(message));
            }
        }
    };

    return logFunctions;
};

module.exports = { createNew };

