function onHomeyReady(Homey) {
    const _settingsKey = `com.eufylife.security.settings`;

    const initializeSettings = function (err, data) {
        if (err || !data) {
            document.getElementById('error').innerHTML = err;
            return;
        }

        document.getElementById('eufy_user').value = data['USERNAME'];
        document.getElementById('eufy_pass').value = data['PASSWORD'];
        document.getElementById('eufy_DEBUG').checked = data['SET_DEBUG'];

        const hubs = data['HUBS'];
        if(data['HUBS_AMOUNT'] > 0) {
            emptyFieldSet()
            Object.keys(hubs).forEach(function(key, index) {
                createFieldSet(hubs[key], index);
            });
        }

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

function createFieldSet(hub, index) {
    let ACTOR_ID = "";
    if(index === 0) {
        ACTOR_ID = '<div class="field row"><label for="eufy_ACTOR_ID">ACTOR_ID</label><input type="text" name="eufy_ACTOR_ID" value="'+hub['ACTOR_ID']+'" disabled /></div>';
    }
    var fieldSetWrapper = document.getElementById('eufy_HUB_SETTINGS');
    let fieldset = document.createElement('fieldset');
    fieldset.id = hub.STATION_SN;
    fieldset.innerHTML = '<legend>Hub Settings - '+ hub['HUB_NAME'] +'</legend><div class="field row"><label style="color: red;">Make sure this is an local ip addres like 192.168.x.x.</label><br><label for="eufy_LOCAL_STATION_IP">LOCAL_STATION_IP</label><input type="text" name="eufy_LOCAL_STATION_IP" value="'+hub['LOCAL_STATION_IP']+'" /></div><div class="field row"><label for="eufy_STATION_SN">STATION_SN</label><input type="text" name="eufy_STATION_SN" value="'+hub['STATION_SN']+'" disabled /></div>'+ACTOR_ID;
    fieldSetWrapper.appendChild(fieldset);
}

function emptyFieldSet() {
    var fieldSetWrapper = document.getElementById('eufy_HUB_SETTINGS');
    fieldSetWrapper.innerHTML = "";
}

function initSave(_settings) {
    console.log(_settings);
    document.getElementById('save').addEventListener('click', function (e) {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        const success = document.getElementById('success');
        const button = document.getElementById('save');

        const USERNAME = document.getElementById('eufy_user').value;
        const PASSWORD = document.getElementById('eufy_pass').value;
        const SET_DEBUG = document.getElementById('eufy_DEBUG').checked

        let HUBS_OBJECT = _settings.HUBS;
        const HUB_SETTINGS = document.getElementById('eufy_HUB_SETTINGS');
        const hubs = HUB_SETTINGS.getElementsByTagName('fieldset');

        for (let hub of hubs) {
            const inputs = hub.getElementsByTagName("input")
            for (input of inputs) {
                if(input.name === 'eufy_LOCAL_STATION_IP') {
                    HUBS_OBJECT[hub.id].LOCAL_STATION_IP = input.value;
                }
            }
        }

        const settings = {
            USERNAME,
            PASSWORD,
            SET_DEBUG,
            HUBS: HUBS_OBJECT,
            HUBS_AMOUNT: _settings.HUBS_AMOUNT,
            CREDENTIALS: _settings.CREDENTIALS,
            SET_CREDENTIALS: true,
            ADMIN: false
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

        const settings = {
            USERNAME: "",
            PASSWORD: "",
            HUBS: {},
            HUBS_AMOUNT: 0,
            SET_DEBUG: false,
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