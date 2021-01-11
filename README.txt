Add support for Eufy Cam/Doorbell in Homey.

Account Information

Because of the way the Eufy Security private API works, an email/password combo cannot
work with both the Eufy Security mobile app and this library. It is recommended to
use the mobile app to create a secondary "guest" account with a separate email address
and use it with this library.

Usage
- Install this app on your Homey.
- Go to the app settings and provide your Username and Password. Click Save Changes
- Other keys will be fetched and filled in to the settings page.
- Connect a device to Eufy Security
- Create a flow wit Euufy Security devices

Current features:
- turn on/off camera (EufyCam pan&tilt will turn its lens)
- Set guard mode (Home, Away, Disarmed, Schedule)
- Add devices and use them in flows. (on/off)
- Get notifications based on detection modes for specific devices. (Motion, Face, Sound and Doorbell Press) 
