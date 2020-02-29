let fs = require("fs"),
    noble = require("@abandonware/noble"),
    debug = require('debug')('nuimojs'),
    EventEmitter = require("events").EventEmitter;

let Device = require("./src/device.js");

let ready = false,
    wantScan = false;

noble.on("stateChange", (state) => {
    ready = (state === "poweredOn");
    if (ready) {
        if (wantScan) {
            noble.startScanning();
        }
    } else {
        noble.stopScanning();
    }
});

class Nuimo extends EventEmitter {


    constructor (whitelist) {
        super();
        this._connectedDevices = {};
        this._discoveredDevices = [];
        this._useWhitelist = false;

        if (whitelist) {
            if (Array.isArray(whitelist)) {
                this._whitelist = whitelist;
                this._useWhitelist = true;
            } else if (typeof whitelist === "string") {
                this._whitelist = [whitelist];
                this._useWhitelist = true;
            }
        }
    }


    static get Direction () {
        return Device.Direction;
    }


    static get Swipe () {
        return Device.Swipe;
    }


    static get Fly () {
        return Device.Fly;
    }


    static get Area () {
        return Device.Area;
    }


    static get Options () {
        return Device.Options;
    }


    static get wirething () {
        return JSON.parse(fs.readFileSync(`${__dirname}/Wirefile`));
    }


    scan () {
        wantScan = true;

        noble.on("discover", (peripheral) => {

            let advertisement = peripheral.advertisement;

            if (advertisement.localName === "Nuimo") {

                if (this._discoveredDevices.includes(peripheral.uuid)) {
                    // avoid double discoveries
                    return
                } else {
                    this._discoveredDevices.push(peripheral.uuid);
                }

                if (this._useWhitelist && this._whitelist.indexOf(peripheral.uuid) < 0) {
                    debug("Discovered device not in UUID whitelist");
                    return;
                }



                peripheral.removeAllListeners();
                noble.stopScanning();
                noble.startScanning();

                let device = new Device(peripheral);

                device._peripheral.on("connect", () => {
                    debug("Peripheral connected");
                    this._connectedDevices[device.uuid] = device;
                });

                device._peripheral.on("disconnect", () => {
                    debug("Peripheral disconnected");
                    delete this._connectedDevices[device.uuid];
                    var index = this._discoveredDevices.indexOf(device.uuid);
                    if (index !== -1) this._discoveredDevices.splice(index, 1);

                    if (wantScan) {
                        noble.startScanning();
                    }

                    device.emit("disconnect");
                });

                this.emit("discover", device);
            }
        });

        if (ready) {
            noble.startScanning();
        }
    }


    wirethingInit () {
        this.scan();
    }


    stop () {
        wantScan = false;
        noble.stopScanning();
    }


    getConnectedDeviceByUUID (uuid) {
        return this._connectedDevices[uuid];
    }


    getConnectedDevices () {
        return Object.keys(this._connectedDevices).map((uuid) => {
            return this._connectedDevices[uuid];
        })
    }


}

module.exports = Nuimo;
