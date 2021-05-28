# Eufy Security

Add support for Eufy Cam in Homey.
Based on: https://github.com/martijnpoppen/eufy-node-client

Link: https://homey.app/nl-nl/app/com.eufylife.security/Eufy-Security/

# Account Information

Because of the way the Eufy Security private API works, an email/password combo cannot
work with _both_ the Eufy Security mobile app _and_ this library. It is recommended to
use the mobile app to create a secondary "guest" account with a separate email address
and use it with this library.

# Usage

- Install this app on your Homey.
- Go to the app settings and provide your Username and Password. Click Save Changes
- Other keys will be fetched and filled in to the settings page.
- Connect a device to Eufy Security
- Create a flow with Eufy Security devices

## Current features:

- Turn on/off camera (EufyCam pan&tilt will turn its lens)
- Set Security mode (Home, Away, Disarmed, Schedule)
- Trigger events based on changed Security modes. Possible combination with keypad.
- Get notifications based on detection modes for specific devices. (Motion, Face, Sound and Doorbell Press)
- Get images when motion is detected
- See last motion events
- Generic alarm for each camera -> Heimdall (goes off for all events except doorbell press)
- Start Stream and retrieve RTSP url

---

&nbsp;

## Donation

If this project help you reduce time to develop, you can give me a cup of coffee :)

[![paypal](https://www.paypalobjects.com/en_US/NL/i/btn/btn_donateCC_LG.gif)](https://paypal.me/martijnpoppen)

&nbsp;

---
