const fs = require('fs');
const path = require('path');

exports.until = async function (predFn) {
    const poll = (done) => (predFn() ? done() : setTimeout(() => poll(done), 500));
    return new Promise(poll);
};

// get
exports.get = function (obj, dirtyPath, defaultValue) {
    if (obj === undefined || obj === null) return defaultValue;
    const path = typeof dirtyPath === 'string' ? dirtyPath.split('.') : dirtyPath;
    let objLink = obj;
    if (Array.isArray(path) && path.length) {
        for (let i = 0; i < path.length - 1; i++) {
            const currentVal = objLink[path[i]];
            if (currentVal !== undefined && currentVal !== null) {
                objLink = currentVal;
            } else {
                return defaultValue;
            }
        }
        const value = objLink[path[path.length - 1]];
        return value === undefined || value === null ? defaultValue : value;
    }
    return defaultValue;
};

exports.keyByValue = function (obj, value) {
    return Object.keys(obj).find((key) => obj[key] === value);
};

exports.keyByValueIncludes = function (obj, value) {
    return Object.keys(obj).find((key) => value.includes(obj[key]));
};

exports.sleep = async function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

exports.randomNumber = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

exports.isNil = function (value) {
    return value === null || value === undefined || value === '';
};

exports.imageExists = function (filePath, log = console.log) {
    if (!fs.existsSync(filePath)) {
        const placeholderPath = path.join(__dirname, '../assets/images/placeholder.jpg');
        fs.copyFileSync(placeholderPath, filePath);
        fs.chmodSync(dirPath, 0o777);
        log('Placeholder black image created:', filePath);
    } else {
        fs.chmodSync(filePath, 0o777);
        log('Image already exists:', filePath);
    }
};

exports.waitUntil = async function (condition, timeoutError = '', interval = 100, timeout = 5000) {
    const start = Date.now();

    while (true) {
        if (condition()) {
            return condition();
        }
        if (Date.now() - start > timeout) {
            if (timeoutError) {
                throw new Error(`Timed out waiting for ${timeoutError}`);
            }
            return true;
        }
        await new Promise((r) => setTimeout(r, interval));
    }
};


