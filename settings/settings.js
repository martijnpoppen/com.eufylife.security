function onHomeyReady(Homey) {
    const _settingsKey = `com.eufylife.security.settings`;

    const initializeSettings = function (err, data) {
        if (err || !data) {
            document.getElementById('error').innerHTML = err;
            return;
        }

        document.getElementById('eufy_user').value = data['USERNAME'];
        document.getElementById('eufy_pass').value = data['PASSWORD'];

        initSave(data);
        initClear(data);
    }

    // --------------------------------------------------------------

    Homey.get(_settingsKey, initializeSettings);
    Homey.on('settings.set', (key, data) => {
        if (key == _settingsKey) {
            Homey.get(_settingsKey, initializeSettings);
        }
    });

    Homey.ready();
}

function emptyFieldSet() {
    var fieldSetWrapper = document.getElementById('eufy_HUB_SETTINGS');
    fieldSetWrapper.innerHTML = "";
}

function initSave(_settings) {
    document.getElementById('save').addEventListener('click', function (e) {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        const success = document.getElementById('success');
        const button = document.getElementById('save');

        const USERNAME = document.getElementById('eufy_user').value;
        const PASSWORD = document.getElementById('eufy_pass').value;

        let HUBS_OBJECT = _settings.HUBS;

        const settings = {
            USERNAME,
            PASSWORD,
            HUBS: HUBS_OBJECT,
            CREDENTIALS: _settings.CREDENTIALS,
            SET_CREDENTIALS: true
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
            const error = 'Fill in USERNAME and PASSWORD.';
            Homey.alert(error);

            error.innerHTML = error;
            button.disabled = false;
            loading.innerHTML = "";
            success.innerHTML = "";
        }
        
    });
}


function initClear(_settings) {
    document.getElementById('clear').addEventListener('click', function (e) {
        error = document.getElementById('error');
        loading = document.getElementById('loading');
        success = document.getElementById('success');

        emptyFieldSet();
        document.getElementById('eufy_user').value = "";
        document.getElementById('eufy_pass').value = "";
        document.getElementById('eufy_DEBUG').checked = false;
        let HUBS_OBJECT = _settings.HUBS;

        const settings = {
            USERNAME: "",
            PASSWORD: "",
            HUBS: HUBS_OBJECT,
            CREDENTIALS: undefined,
            SET_CREDENTIALS: true,
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