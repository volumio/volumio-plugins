# volumio-duo-plugin
A DUO plugin compiled for Volumio (Debian Jessie) on 32-bit ARM platforms (Raspberry Pi to be precise). Other platforms might follow, but I will need time to compile and test.

## Why?
This plugin adds two-factor authentication (2FA) for SSH sessions to your Volumio device. At this moment there are still some issues when changing the password, as some hard-coded functions require the default password. However, security can be hardened by adding two-factor authentication to (at least) starting SSH sessions.

## How?
The plugin will take care of the heavy lifting, it will install a pre-compiled binary (base on DUO's source code; read the official documentation for more info) and prepare necessary configuration. The plugin settings page will allow you to fill in your integration settings (integration key, secret key and API hostname; amongst others). You can turn off DUO authentication by flicking the 'enable DUO' switch to off position. Finally the PAM configuration for the SSH daemon is patched, based on the selected options in the plugin. By default DUO will fail-open, so you will not brick your system if you accidentally misconfig (I do advise against doing so ;) ).

Official DUO documentation can be found here: https://duo.com/docs/duounix#test-pam_duo

## What?
As said the plugin will enable DUO 2FA for starting/authenticating SSH sessions.

The login prompt will still look the same
![Alt text](/images/duo_login_volumio.png?raw=true "Volumio login prompt screen")

Until you fill in both username and password (the latter is optional, see plugin settings screen) and you will receive a prompt on your phone (if configured obviously). It will show on the screen that a request has been pushed, when logging in, it will appear to be hanging.
![Alt text](/images/duo_logged_in_volumio.png?raw=true "Volumio logged in screen")

As said you will receive a nice push message, with a pop-up describing the push
![Alt text](/images/duo_ios_popup.jpeg?raw=true "Push pop-up example")
You only need to confirm by pressing the big green button (bottom left)
![Alt text](/images/duo_push_msg.jpeg?raw=true "DUO authentication request example")

You can follow authentication requests in your DUO dashboard (Reports)
![Alt text](/images/duo_auth_log.png?raw=true "DUO authentication report example")

## Prepare you DUO account
Obviously you will need an account, just register at DUO: https://duo.com/pricing/duo-free

When logged in, you can create an application you would like to protect with DUO. For SSH you should select 'UNIX Application', scroll down to settings to give it a name you can recognize (I named mine 'Volumio SSH'). Fill in the integration and secret key in the plugin, just like the API hostname, saving the settings will publish the DUO config to the PAM-module. Note that if your mobile device has not been enrolled, you can trigger the enrollment by opening an SSH session (I had some issues, so I disabled password for the time being and connected while passing the username: `ssh volumio@{volumio-ip}`). Follow the URL (open in your browser) and enroll your device. That's it! You're can protect your Volumio device with DUO.

### Advanced
If you're actively using DUO, you can alias the volumio username to your user. That way the authentication will reflect as you, instead of unknown (or you can create a volumio user in the dashboard). Obviously you can play around with policies as well, to make sure you tighten security as much as possible without compromising ease-of-use.