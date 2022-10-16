const createNew = (ctxPath, debugEnabled = false) => {
    const localLogger = require('consola').withScope(ctxPath);
    const fullMessage = (message) => `[${ctxPath}] ${message}`;
    const logFunctions = {
        debug(message, args) {
            if(debugEnabled) {
                if (args) {
                    localLogger.info(fullMessage(message), args);
                } else {
                    localLogger.info(fullMessage(message));
                }
            }
           
        },
        success(message, args) {
            if (args) {
                localLogger.success(fullMessage(message), args);
            } else {
                localLogger.success(fullMessage(message));
            }
        },
        info(message, args) {
            if (args) {
                localLogger.info(fullMessage(message), args);
            } else {
                localLogger.info(fullMessage(message));
            }
        },
        warn(message, args) {
            if (args) {
                localLogger.warn(fullMessage(message), args);
            } else {
                localLogger.warn(fullMessage(message));
            }
        },
        error(message, args) {
            if (args) {
                localLogger.error(fullMessage(message), args);
            } else {
                localLogger.error(fullMessage(message));
            }
        }
    };

    return logFunctions;
};

module.exports = { createNew };

