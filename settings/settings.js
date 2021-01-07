function onHomeyReady(Homey) {
    const _settingsKey = `com.eufylife.security.settings`;
    let _credentials = undefined;

    var initializeSettings = function (err, data) {
        if (err || !data) {
            document.getElementById('error').innerHTML = err;
            return;
        }

        document.getElementById('error').innerHTML = '';
        document.getElementById('eufy_user').value = data['USERNAME'];
        document.getElementById('eufy_pass').value = data['PASSWORD'];
        document.getElementById('eufy_DSK_KEY').value = data['DSK_KEY'];
        document.getElementById('eufy_P2P_DID').value = data['P2P_DID'];
        document.getElementById('eufy_ACTOR_ID').value = data['ACTOR_ID'];
        document.getElementById('eufy_STATION_SN').value = data['STATION_SN'];
        document.getElementById('eufy_LOCAL_STATION_IP').value = data['LOCAL_STATION_IP'];
        document.getElementById('eufy_CREDENTIALS').checked = data['SET_CREDENTIALS'];
        _credentials = data['CREDENTIALS'];
    }

    Homey.get(_settingsKey, initializeSettings);
    Homey.on('settings.set', (key, data) => {
        if (key == _settingsKey) {
            Homey.get(_settingsKey, initializeSettings);
        }
    });

    // Tell Homey we're ready to be displayed
    Homey.ready();


    document.getElementById('save').addEventListener('click', function (e) {
        var error = document.getElementById('error');
        var loading = document.getElementById('loading');
        var success = document.getElementById('success');

        var button = document.getElementById('save');
        var USERNAME = document.getElementById('eufy_user').value;
        var PASSWORD = document.getElementById('eufy_pass').value;
        var DSK_KEY = document.getElementById('eufy_DSK_KEY').value;
        var P2P_DID = document.getElementById('eufy_P2P_DID').value;
        var ACTOR_ID = document.getElementById('eufy_ACTOR_ID').value;
        var STATION_SN = document.getElementById('eufy_STATION_SN').value;
        var LOCAL_STATION_IP = document.getElementById('eufy_LOCAL_STATION_IP').value;
        var SET_CREDENTIALS = document.getElementById('eufy_CREDENTIALS').checked;
        var CREDENTIALS = _credentials;

        var settings = {
            USERNAME,
            PASSWORD,
            DSK_KEY,
            P2P_DID,
            ACTOR_ID,
            STATION_SN,
            LOCAL_STATION_IP,
            SET_CREDENTIALS,
            CREDENTIALS
        }

        // ----------------------------------------------

        button.disabled = true;
        loading.innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>Logging in. Please wait until all fields are filled in.';
        error.innerHTML = "";
        success.innerHTML = "";

        if(USERNAME && PASSWORD) {
            Homey.api('PUT', '/login', settings, function (err, result) {
                if (err) {
                    error.innerHTML = err;
                    loading.innerHTML = "";
                    button.disabled = false;
                    return Homey.alert(err);
                } else {
                    button.disabled = false;
                    loading.innerHTML = "";
                    error.innerHTML = "";
                    success.innerHTML = "Saved. Logged in to EufyLife";
                }
            });
        } else {
            var error = 'Fill in USERNAME and PASSWORD.';
            Homey.alert(error);

            error.innerHTML = error;
            button.disabled = false;
            loading.innerHTML = "";
            success.innerHTML = "";
        }
        
    });


    document.getElementById('clear').addEventListener('click', function (e) {
        error = document.getElementById('error');
        loading = document.getElementById('loading');
        success = document.getElementById('success');


        document.getElementById('eufy_user').value = "";
        document.getElementById('eufy_pass').value = "";
        document.getElementById('eufy_DSK_KEY').value = "";
        document.getElementById('eufy_P2P_DID').value = "";
        document.getElementById('eufy_ACTOR_ID').value = "";
        document.getElementById('eufy_STATION_SN').value = "";
        document.getElementById('eufy_LOCAL_STATION_IP').value = "";
        document.getElementById('eufy_CREDENTIALS').checked = false;

        var USERNAME = "";
        var PASSWORD = "";
        var DSK_KEY = "";
        var P2P_DID = "";
        var ACTOR_ID = "";
        var STATION_SN = "";
        var LOCAL_STATION_IP = "";
        var SET_CREDENTIALS = false;
        var CREDENTIALS = undefined;

        var settings = {
            USERNAME,
            PASSWORD,
            DSK_KEY,
            P2P_DID,
            ACTOR_ID,
            STATION_SN,
            LOCAL_STATION_IP,
            SET_CREDENTIALS,
            CREDENTIALS
        }

        Homey.api('PUT', '/settings', settings, function (err, result) {
            if (err) {
                error.innerHTML = err;
                loading.innerHTML = "";
                success.innerHTML = "";
                return Homey.alert(err);
            } else {
                loading.innerHTML = "";
                error.innerHTML = "";
                success.innerHTML = "Cleared & Saved.";
            }
        });
    });
}