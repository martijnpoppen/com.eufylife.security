Add support for Eufy Cam/Doorbell in Homey.

Account Information

Because of the way the Eufy Security private API works, an email/password combo cannot
work with both the Eufy Security mobile app and this app. It is recommended to
use the mobile app to create a secondary "admin" account with a separate email address
and use it with this app. (Make sure 2FA is disabled for this account)

Usage
- Install this app on your Homey.
- Go to `add devices` 
- Provide your Username and Password. Click Next
- Available devices show up

Current features:
- Turn on/off camera (EufyCam pan&tilt will turn its lens)
- Set Security mode (Home, Away, Disarmed, Schedule)
- Trigger events based on changed Security modes. Possible combination with keypad.
- Get notifications based on detection modes for specific devices. (Motion, Face, Sound and Doorbell Press) 
- Get images when motion is detected
- See last motion events
- Generic alarm for each camera -> Heimdall (goes off for all events except doorbell press)
- Start Stream and retrieve RTSP url
- Toggle ALARM for Homebase - This also enables the generic alarm for the Homebase (Heimdall)
- Trigger flows when alarms turns on
- Trigger quickResponses for doorbells
- Trigger HDR
- Trigger WDR
- Trigger night vision
- Reboot Hub or stand-alone cameras
- Force Eufy Homebase notifications to prevent wrong data
- Battery status for Battery devices