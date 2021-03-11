# Eufy Security

Add support for Eufy Cam in Homey.
Based on: https://github.com/JanLoebel/eufy-node-client

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
- turn on/off camera (EufyCam pan&tilt will turn its lens)
- Set guard mode (Home, Away, Disarmed, Schedule)
- Add devices and use them in flows. (on/off)
- Get notifications based on detection modes for specific devices. (Motion, Face, Sound and Doorbell Press) 
- Get images when motion is detected

## To do:
- ~~[Feature Request] check 2FA~~
- [Feature Request] check if the keypad is going to work
- ~~[Feature Request] check RTSP for doorbell~~
- ~~[Feature Request] Preset response - DONE~~
- [Feature Request] Turn the eufy pan&tilt via Homey (e.g.: when you’re home turn 180 degrees to the wall)
- ~~[Feature Request] check if the door sensor is going to work -  - DONE~~
- [Feature Request] check if the motion sensor is going to work - IN PROGRESS
- [Feature Request] Reset debug logs on startup - IN PROGRESS
- [Feature Request] filter devices when pairing - IN PROGRESS
- [Feature Request] Custom settings for security/guard mode - INVESTIGATE
- ~~[Feature Request] Add AND flow card - TO-DO~~
- ~~[BUG] There's an issue with images not updating when devices are paired - DONE~~
- ~~[BUG] commandSend service expired token after x hours. - DONE~~
- ~~[BUG] multiple notifications with Full effect mode - DONE~~

---
&nbsp;
## Donation
If this project help you reduce time to develop, you can give me a cup of coffee :) 

[![paypal](https://www.paypalobjects.com/en_US/NL/i/btn/btn_donateCC_LG.gif)](https://paypal.me/martijnpoppen)

&nbsp;

---
&nbsp;

![image info](./assets/images/eufy1.jpeg)
