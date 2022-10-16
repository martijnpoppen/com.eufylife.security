function onHomeyReady(Homey) {
    const _settingsKey = `com.eufylife.security.settings`;

    const initializeSettings = function (err, data) {
        if (err || !data) {
            document.getElementById('error').innerHTML = err;
            return;
        }

        document.getElementById('eufy_user').value = data['USERNAME'];
        document.getElementById('eufy_pass').value = data['PASSWORD'];
        if (document.querySelector(`input[name="region"][value="${data['REGION']}"]`)) {
            document.querySelector(`input[name="region"][value="${data['REGION']}"]`).checked = true;
        } else {
            document.querySelector(`input[name="region"][value="US"]`).checked = true;
        }

        initSave(data);
    };

    // --------------------------------------------------------------

    Homey.get(_settingsKey, initializeSettings);
    Homey.on('settings.set', (key, data) => {
        if (key == _settingsKey) {
            Homey.get(_settingsKey, initializeSettings);
        }
    });

    Homey.ready();
}

function initSave(_settings) {
    document.getElementById('save').addEventListener('click', function (e) {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        const success = document.getElementById('success');
        const button = document.getElementById('save');

        const USERNAME = document.getElementById('eufy_user').value;
        const PASSWORD = document.getElementById('eufy_pass').value;
        const regionSelect = document.querySelector('input[name="region"]:checked');
        const REGION = regionSelect ? regionSelect.value : 'US';

        const settings = {
            USERNAME,
            PASSWORD,
            REGION,
            NOTIFICATIONS: _settings.NOTIFICATIONS || []
        };

        // ----------------------------------------------

        loading.innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>Logging in. Please wait...';
        error.innerHTML = '';
        success.innerHTML = '';

        if (USERNAME && PASSWORD) {
            Homey.api('PUT', '/login', settings, function (err, result) {
                if (err) {
                    error.innerHTML = err;
                    loading.innerHTML = '';
                    return Homey.alert(err);
                } else {
                    loading.innerHTML = '';
                    error.innerHTML = '';
                    success.innerHTML = 'Saved. Logged in to EufyLife. You can close this screen now.';
                }
            });
        } else {
            const error = 'Fill in USERNAME and PASSWORD.';
            Homey.alert(error);

            error.innerHTML = error;
            button.disabled = false;
            loading.innerHTML = '';
            success.innerHTML = '';
        }
    });
}
