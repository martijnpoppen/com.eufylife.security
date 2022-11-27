const createNew = (ctxPath, debugEnabled = false) => {
    const fullMessage = (message) => `[${ctxPath}] ${message}`;
    const logFunctions = {
        debug(message, args) {
            if(debugEnabled) {
                if (args) {
                    console.info(fullMessage(message), args);
                } else {
                    console.info(fullMessage(message));
                }
            }
           
        },
        success(message, args) {
            if (args) {
                console.log(fullMessage(message), args);
            } else {
                console.log(fullMessage(message));
            }
        },
        info(message, args) {
            if (args) {
                console.info(fullMessage(message), args);
            } else {
                console.info(fullMessage(message));
            }
        },
        warn(message, args) {
            if (args) {
                console.warn(fullMessage(message), args);
            } else {
                console.warn(fullMessage(message));
            }
        },
        error(message, args) {
            if (args) {
                console.error(fullMessage(message), args);
            } else {
                console.error(fullMessage(message));
            }
        }
    };

    return logFunctions;
};

module.exports = { createNew };

