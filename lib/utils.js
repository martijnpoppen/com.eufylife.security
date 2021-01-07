const Homey = require('homey');

// get
exports.get = function(obj, dirtyPath, defaultValue) {
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
}

exports.keyByValue = function(obj, value) {
    return Object.keys(obj).find(key => obj[key] === value);
}
  

exports.onDeviceListVariableAutocomplete = async function ( query, args ) {
    try {
        let results = Homey.app.getDevices();
      
        // filter for query
        results = results.filter( result => {
            return result.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
        });

        Homey.app.log('Found devices - ', results);
      
        return Promise.resolve( results );
    } catch(e) {
        Homey.app.log(e);
    }
}