let async = require("async"),
    debug = require("debug")("nuimojs"),
    EventEmitter = require("events").EventEmitter;


const Swipe = {
    LEFT: 0,
    RIGHT: 1,
    UP: 2,
    DOWN: 3
};

const Fly = {
    LEFT: 0,
    RIGHT: 1
};

const Area = {
    LEFT: 4,
    RIGHT: 5,
    TOP: 6,
    BOTTOM: 7,
    LONGLEFT: 8,
    LONGRIGHT: 9,
    LONGTOP: 10,
    LONGBOTTOM: 11
};

// Direction is now deprecated, use Swipe, Fly, or Area instead
const Direction = Swipe;

// Configuration bits, see https://github.com/nathankunicki/nuimojs/pull/12
const Options = {
    ONION_SKINNING: 16,
    BUILTIN_MATRIX: 32
};


const UUID = {
    Service: {
        BATTERY_STATUS: "180f",
        DEVICE_INFORMATION: "180a",
        LED_MATRIX: "f29b1523cb1940f3be5c7241ecb82fd1",
        USER_INPUT_EVENTS: "f29b1525cb1940f3be5c7241ecb82fd2"
    },
    Characteristic: {
        BATTERY_LEVEL: "2a19",
        DEVICE_INFORMATION: "2a29",
        FLY: "f29b1526cb1940f3be5c7241ecb82fd2",
        SWIPE: "f29b1527cb1940f3be5c7241ecb82fd2",
        ROTATION: "f29b1528cb1940f3be5c7241ecb82fd2",
        BUTTON_CLICK: "f29b1529cb1940f3be5c7241ecb82fd2"
    }
};


class Device extends EventEmitter {


    constructor (peripheral) {
        super();

        this.deviceType = "nuimo";

        this._peripheral = peripheral;
        this._LEDCharacteristic = null;
        this._batteryLevel = 100;
        this._rssi = -100; // Initialize as -100 - no signal
    }


    static get Direction () {
        return Direction;
    }


    static get Swipe () {
        return Swipe;
    }


    static get Fly () {
        return Fly;
    }


    static get Area () {
        return Area;
    }


    static get Options () {
        return Options;
    }


    get uuid () {
        return this._peripheral.uuid;
    }


    get UUID () {
        return this.uuid;
    }


    get batteryLevel () {
        return this._batteryLevel;
    }


    get rssi () {
        return this._rssi;
    }


    get RSSI () {
        return this.rssi;
    }


    connect (callback) {

        let self = this;

        let batteryReady = false;
        let LEDReady = false;
        let userInputs = 0;

        this._peripheral.connect((err) => {

            this._rssi = this._peripheral.rssi;

        let rssiUpdateInterval = setInterval(() => {
                this._peripheral.updateRssi((err, rssi) => {
                if (!err) {
            if (this._rssi != rssi) {
                this._rssi = rssi;
                self.emit("rssiChange", rssi);
            }
        }
    });
    }, 2000);

        self._peripheral.on("disconnect", () => {
            clearInterval(rssiUpdateInterval);
    });
        self._peripheral.discoverServices([], (error, services) => {

            debug("Service discovery started");

            for (var i in services) {
                let serviceIndex = i;
                let service = services[serviceIndex];
                service.discoverCharacteristics([], (error, characteristics) => {
                    for (var e in characteristics) {
                        let characteristic = characteristics[e];

                        switch (service.uuid) {
                            case UUID.Service.BATTERY_STATUS:
                                batteryReady = true;
                                debug("Found Battery characteristic");
                                self._subscribeToCharacteristic(characteristic, self._handleBatteryChange.bind(self));
                                characteristic.read();
                                break;
                            case UUID.Service.LED_MATRIX:
                                self._LEDCharacteristic = characteristic;
                                LEDReady = true;
                                debug("Found LED characteristic");
                                break;
                            case UUID.Service.USER_INPUT_EVENTS:
                                debug('user')
                                switch (characteristic.uuid) {
                                    case UUID.Characteristic.BUTTON_CLICK:
                                        debug("Found Button Click characteristic");
                                        self._subscribeToCharacteristic(characteristic, self._handleClick.bind(self));
                                        break;
                                    case UUID.Characteristic.FLY:
                                        debug("Found Fly characteristic");
                                        self._subscribeToCharacteristic((characteristic), self._handleFlying.bind(self));
                                        break;
                                    case UUID.Characteristic.ROTATION:
                                        debug("Found Rotation characteristic");
                                        self._subscribeToCharacteristic(characteristic, self._handleRotation.bind(self));
                                        break;
                                    case UUID.Characteristic.SWIPE:
                                        debug("Found Swipe characteristic");
                                        self._subscribeToCharacteristic(characteristic, self._handleTouchSwipe.bind(self));
                                        break;
                                }
                                userInputs++;
                                break;
                        }
                        if (batteryReady && LEDReady && userInputs === 5) {
                            debug("Service discovery finished");
                            self.emit("connect");
                        }
                    }
                })
            }
        
        if (callback) {
            return callback();
        }
    });
    });
    }


    disconnect () {
        this._peripheral.disconnect();
    }


    setLEDMatrix (matrixData, brightness, timeout, options) {

        if (this._LEDCharacteristic) {
            let buf = Buffer.alloc(13);

            if (matrixData instanceof Buffer) {
                matrixData.copy(buf);
            } else {
                this._LEDArrayToBuffer(matrixData).copy(buf);
            }

            if (typeof options === "number") {
                buf[10] += options;
            } else if (typeof options === "object") {
                if (options.onion_skinning || options.onionSkinning) {
                    buf[10] += Options.ONION_SKINNING;
                }
                if (options.builtin_matrix || options.builtinMatrix){
                    buf[10] += Options.BUILTIN_MATRIX;
                }
            }

            buf[11] = brightness;
            buf[12] = Math.floor(timeout / 100);

            this._LEDCharacteristic.write(buf, true);
        } else {
            this.emit("error", new Error("Not fully connected"));
        }
    }

    _LEDArrayToBuffer (arr) {
        let buf = Buffer.alloc(11);

        for (let i = 0; i < 11; i++) {
            buf[i] = parseInt(arr.slice(i*8, i*8+8).reverse().join(""), 2);
        }

        return buf;
    }

    _subscribeToCharacteristic (characteristic, callback) {
        characteristic.on("data", (data, isNotification) => {
            return callback(data);
    });
        characteristic.subscribe((err) => {
            if (err) {
                this.emit("error", err);
            }
        });
    }

    _handleBatteryChange (data) {
        this._batteryLevel = data[0];
        debug("Battery level %s%", data[0]);
        this.emit("batteryLevelChange", data[0]);
    }

    _handleTouchSwipe (data) {
        let direction = data[0];
        if (direction <= 3) {
            this.emit("swipe", direction);
        } else {
            this.emit("touch", direction);
        }
        switch (direction) {
            case (Swipe.LEFT):
                debug("Swipe left");
                this.emit("swipeLeft");
                break;
            case (Swipe.RIGHT):
                debug("Swipe right");
                this.emit("swipeRight");
                break;
            case (Swipe.UP):
                debug("Swipe up");
                this.emit("swipeUp");
                break;
            case (Swipe.DOWN):
                debug("Swipe down");
                this.emit("swipeDown");
                break;
            case (Area.LEFT):
                debug("Touch left");
                this.emit("touchLeft");
                break;
            case (Area.RIGHT):
                debug("Touch right");
                this.emit("touchRight");
                break;
            case (Area.TOP):
                debug("Touch top");
                this.emit("touchTop");
                break;
            case (Area.BOTTOM):
                debug("Touch bottom");
                this.emit("touchBottom");
                break;
            case (Area.LONGLEFT):
                debug("Long Touch left");
                this.emit("longTouchLeft");
                break;
            case (Area.LONGRIGHT):
                debug("Long Touch right");
                this.emit("longTouchRight");
                break;
            case (Area.LONGTOP):
                debug("Long Touch top");
                this.emit("longTouchTop");
                break;
            case (Area.LONGBOTTOM):
                debug("Long Touch bottom");
                this.emit("longTouchBottom");
                break;
        }
    }

    _handleClick (data) {
        if (data[0] === 0) {
            debug("Button released");
            this.emit("release");
        } else {
            debug("Button pressed");
            this.emit("press");
        }
    }

    _handleRotation (data) {
        let amount = data.readInt16LE();
        debug("Rotate %s", amount);
        this.emit("rotate", amount);
    }

    _handleFlying (data) {

        let gesture = data[0],
            amount = data[1];

        switch (gesture) {
            case 0:
            case 1:
            case 2:
                let direction = gesture,
                    speed = amount;
                this.emit("fly", direction, speed); break;
                switch (direction) {
                    case (Fly.LEFT):
                        debug("Fly left %s", speed);
                        this.emit("flyLeft", speed);
                        break;
                    case (Fly.RIGHT):
                        debug("Fly right %s", speed);
                        this.emit("flyRight", speed);
                        break;
                }
                break;
            case 4:
                debug("Detect %s", amount);
                this.emit("detect", amount);
                this.emit("distance", amount);
                break;
        }
    }
}

module.exports = Device;
