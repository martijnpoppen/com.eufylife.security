# Eufy Security

Add support for Eufy Cam in Homey.
Based on: https://github.com/JanLoebel/eufy-node-client

# Account Information

Because of the way the Eufy Security private API works, an email/password combo cannot
work with _both_ the Eufy Security mobile app _and_ this library. It is recommended to
use the mobile app to create a secondary "guest" account with a separate email address
and use it with this library.

# Usage
- Install this app on your homey. See https://community.athom.com/t/how-to-cli-install-method/198
- Go to the app settings and provide your Username and Password. Click Save Changes
- Other keys will be fetched and filled in to the settings page.
- Create a virtual device (Homey experiment)
- Create a flow when virtual device is on/off
- In the then part of the flow you can select the guard mode. (see image below)

## Current features:
- turn on/off camera (EufyCam pan&tilt will turn its lens)
- Set guard mode (Home, Away, Disarmed, Schedule)
---
&nbsp;
## Donation
If this project help you reduce time to develop, you can give me a cup of coffee :) 

[![paypal](https://www.paypalobjects.com/en_US/NL/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XFDT3CB8WK82W)

&nbsp;

---
&nbsp;

![image info](./assets/images/eufy1.jpeg)