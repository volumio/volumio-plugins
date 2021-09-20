# Zipi - Plugin Zip File Installer for Volumio

Zipi lets you install plugins packaged in ZIP files. This way, you can install plugins that are not listed in the Volumio repo.

If a plugin is hosted in its own repository on Github, then chances are you can obtain an install-ready ZIP file by clicking the Code button on the Github repo page, followed by Download Zip. This will provide you with a ZIP package containing the latest files of the plugin. You can also go to the Releases section to download the package for a particular version (note: not all plugins are offered in releases).

Once you have the ZIP file ready, open your browser and access Zipi's installer page at `http://<your Volumio address>:<Zipi port (default: 7000)>` (e.g. http://volumio.local:7000). For convenience, you can also go to Zipi's plugin settings and click the Open URL button.

At the installer page, choose the ZIP file to upload and install. Zipi will guide you through the installation process.

## Security

Like Volumio, Zipi is not written with security in mind. That means basically anyone on your network can access the installer. This has security implications, because a plugin has practically unfettered access to your Volumio device and can execute code that can compromise the overall security of your system -- that includes not only your Volumio device, but all devices connected to your network as well.

If you are concerned about this, then you should only enable Zipi when you need to install a plugin and disable it when you are done. You can do this by going to Volumio -> Plugins -> Installed Plugins and flipping the On / Off switch for Zipi.

It also follows without saying that you should **never ever install plugins from unknown / untrusted sources**.

>By using Zipi, you agree that you shall be solely responsible for any loss or damage that may be caused as a result thereof.

## Changelog

0.1.0
- Initial release

## License

MIT