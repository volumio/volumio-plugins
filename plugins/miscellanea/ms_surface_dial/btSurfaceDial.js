const EventEmitter = require("events");
const dbus = require('dbus-next');
dbus.setBigIntCompat(true); // BigInt requires Node 10.8.0 or above
let Variant = dbus.Variant;

//
// [ Events ]
// ready: init() finished
// bt_adapter_available: goes from zero to available
// bt_adapter_removed: goes from available to zero
// bt_adapter_on: goes from off to on
// bt_adapter_off: goes from on to off
// sdial_connected: goes from disconnected to connected
// sdial_disconnected: goes from disconnected to connected
// sdial_unpaired: goes from paired to unpaired
// sdial_removed: sdial removed from device list of bt_adapter
// sdial_paired: goes from unpaired to paired
//
class BluetoothSurfaceDial extends EventEmitter {
    static get SDIAL_NAME() { return 'Surface Dial'; }
    static get BLUEZ_SERVICE() { return 'org.bluez'; }
    static get BLUEZ_OBJNAME() { return '/org/bluez'; }
    static get OBJMANAGER_IFACE_NAME() { return 'org.freedesktop.DBus.ObjectManager'; }
    static get PROPERTIES_IFACE_NAME() { return 'org.freedesktop.DBus.Properties'; }
    static get ADAPTER_IFACE_NAME() { return `${BluetoothSurfaceDial.BLUEZ_SERVICE}.Adapter1`; }
    static get DEVICE_IFACE_NAME() { return `${BluetoothSurfaceDial.BLUEZ_SERVICE}.Device1`; }

    constructor(logger, logLabel) {
        super();
        this.systemBus = dbus.systemBus(); // create only once
        this.hciObjPath = null;
        this.hciObj = null;
        this.sdialObjPath = null; // set even if it's not paired.
        this.sdialObj = null;
        this.logger = logger;
        this.logLabel = logLabel;

        this._mostRecentStatus = {
            btAdapterPresent: false,
            btAdapterOn: false,
            sDialPaired: false,
            sDialConnected: false
        };

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this#this_in_classes
        this.onHciAdapterPropertiesChanged = this.onHciAdapterPropertiesChanged.bind(this);
        this.onSDialPropertiesChanged = this.onSDialPropertiesChanged.bind(this);
    }

    get btAdapterAvailable() {
        return this._mostRecentStatus.btAdapterPresent;
    }
    get btAdapterTurnedOn() {
        return this._mostRecentStatus.btAdapterOn;
    }
    get surfaceDialPaired() {
        return this._mostRecentStatus.sDialPaired;
    }
    get surfaceDialConnected() {
        return this._mostRecentStatus.sDialConnected;
    }

    // Connect to D-Bus and register for event changes
    async init() {
        // Find existing adapter and surface dial
        try {
            const bluezRootNode = await this.systemBus.getProxyObject(BluetoothSurfaceDial.BLUEZ_SERVICE, '/');
            const objMgr = bluezRootNode.getInterface(BluetoothSurfaceDial.OBJMANAGER_IFACE_NAME);
            const busObjs = await objMgr.GetManagedObjects();
            this.logger.info(`${this.logLabel} Managed Objs ${JSON.stringify(busObjs)}`);
            for (const objPath in busObjs) {
                const obj = busObjs[objPath];
                this.logger.info(`[${this.logLabel} init()] check ${objPath}`);
                // find the first controller
                if ((this.adapterNotRegistered()) && this.isBtController(obj)) {
                    await this.addAdapter(objPath, obj);
                    this.logger.info(`[${this.logLabel} init()] added Adapter ${objPath}`);
                }
                // find the first Surface Dial
                if ((this.sdialNotRegistered()) && this.isSurfaceDial(obj)) {
                    await this.addSurfaceDial(objPath, obj);
                    this.logger.info(`[${this.logLabel} init()] added SurfaceDial ${objPath}`);
                }
            }
            // Handle case where Surface Dial is binded to the first Adapter
            this.logger.info(`[${this.logLabel} init()] Adapter: ${this.hciObjPath}; SurfaceDial: ${this.sdialObjPath}`);
            // Monitor changes to Bluetooth Controllers and Paired-Surface-Dial
            // Object added or Interfaces Added to an existing Object
            objMgr.on('InterfacesAdded', async(objPath, ifacesAndProps) => {
                this.logger.info(`${this.logLabel} Interfaces Added @ ${objPath}: ${JSON.stringify(ifacesAndProps)} `);
                // Ignore if we already have a Bluetooth Adapter registered
                if (this.adapterNotRegistered() && this.isBtController(ifacesAndProps)) {
                    await this.addAdapter(objPath, ifacesAndProps);
                    this.logger.info(`[${this.logLabel} init()] added Adapter ${objPath}`);
                }
                else if ((this.sdialNotRegistered()) && this.isSurfaceDial(ifacesAndProps)) {
                    await this.addSurfaceDial(objPath, ifacesAndProps);
                    this.logger.info(`[${this.logLabel} init()] added SurfaceDial ${objPath}`);
                }
            });
            // Object removed or Interfaces Removed from an existing Object
            objMgr.on('InterfacesRemoved', (objPath, ifaces) => {
                this.logger.info(`${this.logLabel} Interfaces Removed @ ${objPath}: ${ifaces} `);
                if (objPath == this.hciObjPath) {
                    this.removeAdapter(objPath);
                }
                else if (objPath == this.sdialObjPath) {
                    this.removeSurfaceDial(objPath);
                }
            });
            // Check if SurfaceDial (if registered) is managed by our primary Bluetooth Adapter
            if (!this.sdialNotRegistered()) {
                this.isSurfaceDialAssociatedWithAdapter()
                .then((isAssociated) => {
                    if (!isAssociated) {
                        this.logger.error(`${this.logLabel} ${this.sdialObjPath} does not belong to ${this.hciObjPath}`);
                    }
                    else {
                        this.logger.info(`${this.logLabel} Good! ${this.sdialObjPath} belongs to ${this.hciObjPath}`);
                    }
                    this.emit('ready');
                })
                .catch((err) => {
                    this.logger.error(`${this.logLabel} error from isSurfaceDialAssociatedWithAdapter(). ${err}`);
                    this.emit('ready');
                });
            }
            else {
                // Surface Dial not registered. No need to check to which HCI adapter it belongs.
                this.emit('ready');
            }
        }
        catch(err) {
            this.logger.error(`${this.logLabel} Exception caught in BluetoothSurfaceDial.init() ${err}`);
            this.emit('ready');
        }   
    }

    deInit()
    {
        this.systemBus.disconnect();
    }

    adapterNotRegistered() {
        return (!this.hciObjPath);
    }

    onHciAdapterPropertiesChanged(iface, changed, invalidated) {
        let self = this;
        try {
            this.logger.info(`${this.logLabel} ${iface} PropertiesChanged.`);
            for (const prop in changed) {
                this.logger.info(`${this.logLabel} ${this.hciObjPath} property ${prop} changed to ${changed[prop].value}`);
            }
            for (const prop in invalidated) {
                this.logger.info(`${this.logLabel} ${this.hciObjPath} property ${prop} changed to ${invalidated[prop].value}`);
            }
            // Interface: Adapter1
            //  Powered (Boolean)
                // emit signal if it is turned on or off
            if ('Powered' in changed) {
                this._mostRecentStatus.btAdapterOn = changed['Powered'].value;
                this.emit(this._mostRecentStatus.btAdapterOn? 'bt_adapter_on':'bt_adapter_off');
            }
            //  Discovering (Boolean)
        }
        catch (err) {
            this.logger.error(`${this.logLabel} ${this.hciObjPath} PropertiesChanged error: ${err}`);
        }
    }

    async addAdapter(objPath, ifaces) {
        if (! this.hciObjPath) {
            // Update instance property
            this.hciObjPath = objPath;
            // Set up monitor on this obj
            try {
                this.hciObj = await this.systemBus.getProxyObject(BluetoothSurfaceDial.BLUEZ_SERVICE, this.hciObjPath);
                const properties = this.hciObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                // Add event-listener
                properties.on('PropertiesChanged', this.onHciAdapterPropertiesChanged);
                // Update State variables
                this._mostRecentStatus.btAdapterPresent = true;
                this._mostRecentStatus.btAdapterOn = ifaces[BluetoothSurfaceDial.ADAPTER_IFACE_NAME]['Powered'].value;
                // notify
                this.emit('bt_adapter_available');
            }
            catch (err) {
                this.logger.error(`${this.logLabel} ${this.hciObjPath} setup error. ${err}`);
            }
        }
    }

    removeAdapter(objPath) {
        // Update instance property
        if (objPath == this.hciObjPath) {
            this.hciObjPath = null;
            // Remove event-listener
            const properties = this.hciObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
            properties.removeListener('PropertiesChanged', this.onHciAdapterPropertiesChanged);
            this.hciObj = null;
            // Update State variables
            this._mostRecentStatus.btAdapterPresent = false;
            // notify
            this.emit('bt_adapter_removed');
        }
    }

    // busObj: Dictionary <Interface:string, Dictionary<Property:string, Variant>> >
    // return true if it is.
    isBtController(busObj) {
        // Look for the Adapter Interface
        return busObj.hasOwnProperty(BluetoothSurfaceDial.ADAPTER_IFACE_NAME);
    }
  
    // see if the device is a Surface-Dial
    // busObj: Dictionary <Interface:string, Dictionary<Property:string, Variant>> >
    // return true if it is.
    isSurfaceDial(busObj) {
        let isSdial = false;
        // Look for the Device Interface
        if (busObj.hasOwnProperty(BluetoothSurfaceDial.DEVICE_IFACE_NAME)) {
            let deviceObj = busObj[BluetoothSurfaceDial.DEVICE_IFACE_NAME];
            // Look for Name property, Alias otherwise
            if (deviceObj.hasOwnProperty('Name')) {
                isSdial = (BluetoothSurfaceDial.SDIAL_NAME == deviceObj['Name'].value);
            }
            else if (deviceObj.hasOwnProperty('Alias')) {
                isSdial = (BluetoothSurfaceDial.SDIAL_NAME == deviceObj['Alias'].value);
            }
        }
        return isSdial;
    }

    sdialNotRegistered() {
        return (!this.sdialObjPath);
    }

    onSDialPropertiesChanged(iface, changed, invalidated) {
        try {
            this.logger.info(`${this.logLabel} ${iface} PropertiesChanged.`);
            for (const prop in changed) {
                this.logger.info(`${this.logLabel} ${this.sdialObjPath} property ${prop} changed to ${changed[prop].value}`);
            }
            for (const prop in invalidated) {
                this.logger.info(`${this.logLabel} ${this.sdialObjPath} property ${prop} changed to ${invalidated[prop].value}`);
            }
            // Interface: Device1
            //  Paired (Boolean)
                // emit signal if it is paired or unpaired
            if ('Paired' in changed) {
                this._mostRecentStatus.sDialPaired = changed['Paired'].value;
                this.emit(this._mostRecentStatus.sDialPaired? 'sdial_paired' : 'sdial_unpaired');
            }
            //  Connected (Boolean)
                // emit signal if it is connected or disconnected
            if ('Connected' in changed) {
                this._mostRecentStatus.sDialConnected = changed['Connected'].value;
                if (this._mostRecentStatus.sDialConnected) {
                    this.emit('sdial_connected');
                }
                else {
                    this.emit('sdial_disconnected');
                }
            }
        }
        catch (err) {
            this.logger.error(`${this.logLabel} ${this.sdialObjPath} PropertiesChanged error: ${err}`);
        }
    }

    // add surface dial to class instance
    async addSurfaceDial(objPath, ifacesObj) {
        if (!this.sdialObjPath) {
            // Update instance properties
            this.sdialObjPath = objPath;
            // Set up monitor
            try {
                this.sdialObj = await this.systemBus.getProxyObject(BluetoothSurfaceDial.BLUEZ_SERVICE, this.sdialObjPath);
                if (BluetoothSurfaceDial.DEVICE_IFACE_NAME) {
                    let deviceIface = ifacesObj[BluetoothSurfaceDial.DEVICE_IFACE_NAME];
                    this._mostRecentStatus.sDialPaired = deviceIface['Paired'].value;
                    this._mostRecentStatus.sDialConnected = deviceIface['Connected'].value;
                } 
                let properties = this.sdialObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                properties.on('PropertiesChanged', this.onSDialPropertiesChanged);
            }
            catch (err) {
                this.logger.error(`${this.logLabel} ${this.sdialObjPath} setup error. ${err}`);
            }
        }
    }
    
    // remove surface dial from class instance
    removeSurfaceDial(objPath) {
        if (this.sdialObjPath == objPath) {
            
            // Remove Event-Listeners
            let properties = this.sdialObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
            properties.removeListener('PropertiesChanged', this.onSDialPropertiesChanged);
            // Update instance properties
            this.sdialObjPath = null;
            this.sdialObj = null;
            this._mostRecentStatus.sDialPaired = false;
            // notify
            this.emit('sdial_removed');
            
        }
    }

    // check the instance's Surface Dial
    // belong to the instance's HCI Adapter
    // Return: Promise<Boolean> Here because getInterface is a callback
    isSurfaceDialAssociatedWithAdapter() {
        return new Promise(async(resolve, reject) => {
            let isAssociated = false;
            if (this.sdialObj && this.hciObjPath) {
                let properties = this.sdialObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                properties.Get(BluetoothSurfaceDial.DEVICE_IFACE_NAME, 'Adapter')
                .then(adapterVariant => {
                    isAssociated = (this.hciObjPath == adapterVariant.value);
                    resolve(isAssociated);
                })
                .catch(err => {
                    reject(new Error(`${this.logLabel} Exception caught getting ${this.sdialObjPath} 
                    Device1.Adapter value : ${err}`));
                });
            }
            else {
                resolve(false);
            }
        });
    }

    async connectSurfaceDial() {
        // Check conditions before setting 
        if (this.sdialObj != null) {
            try {
                let deviceIface = this.sdialObj.getInterface(BluetoothSurfaceDial.DEVICE_IFACE_NAME);
                await deviceIface.Connect(); // asynchronous
                this.logger.info(`${this.logLabel} SurfaceDial Device1.Connect() returns.`);
            }
            catch (err) {
                this.logger.error(`${this.logLabel} Error Connecting to Surface Dial. ${err}`);
            }
        }
    }

    async disconnectSurfaceDial() {
        // Check conditions before setting 
        if (this.sdialObj != null) {
            try {
                let deviceIface = this.sdialObj.getInterface(BluetoothSurfaceDial.DEVICE_IFACE_NAME);
                await deviceIface.Disconnect(); // asynchronous
                this.logger.info(`${this.logLabel} SurfaceDial Device1.Disconnect() returns.`);
            }
            catch (err) {
                this.logger.error(`${this.logLabel} Error Disconnecting from Surface Dial. ${err}`);
            }
        }
    }

    async turnOffBluetooth() {
        if (this.hciObj != null) {
            try {
                const properties = this.hciObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                await properties.Set(BluetoothSurfaceDial.ADAPTER_IFACE_NAME, 'Powered', new Variant('b', false));
                this.logger.info(`${this.logLabel} Set Adapter1.Powered to false returns.`);
            }
            catch (err) {
                this.logger.error(`${this.logLabel} Error Powering off Bluetooth Adapter. ${err}`);
            }
        }
    }

    async turnOnBluetooth() {
        if (this.hciObj != null) {
            try {
                const properties = this.hciObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                await properties.Set(BluetoothSurfaceDial.ADAPTER_IFACE_NAME, 'Powered', new Variant('b', true));
                this.logger.info(`${this.logLabel} Set Adapter1.Powered to true returns.`);
            }
            catch (err) {
                this.logger.error(`${this.logLabel} Error Powering on Bluetooth Adapter. ${err}`);
            }
        }
    }
}

module.exports = { BluetoothSurfaceDial };