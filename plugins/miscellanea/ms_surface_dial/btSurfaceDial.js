const EventEmitter = require("events");
const dbus = require('dbus-next');
dbus.setBigIntCompat(true); // BigInt requires Node 10.8.0 or above

//
// [ Events ]
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
        this.sdialObjPath = null; // only set if it is paired
        this.sdialObj = null;
        this.logger = logger;
        this.logLabel = logLabel;
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
                    await this.addAdapter(objPath);
                    this.logger.info(`[${this.logLabel} init()] added Adapter ${objPath}`);
                }
                // find the first Surface Dial
                if ((this.sdialNotRegistered()) && this.isPairedSurfaceDial(obj)) {
                    await this.addSurfaceDial(objPath);
                    this.logger.info(`[${this.logLabel} init()] added SurfaceDial ${objPath}`);
                }
            }
            // Handle case where Surface Dial is binded to the first Adapter
            this.logger.info(`[${this.logLabel} init()] Adapter: ${this.hciObjPath}; SurfaceDial: ${this.sdialObjPath}`);
            this.isSurfaceDialAssociatedWithAdapter()
            .then((isAssociated) => {
                if (!isAssociated) {
                    this.logger.error(`${this.logLabel} ${this.sdialObjPath} does not belong to ${this.hciObjPath}`);
                }
                else {
                    this.logger.info(`${this.logLabel} Good! ${this.sdialObjPath} belongs to ${this.hciObjPath}`);
                }
            });

            // Monitor changes to Bluetooth Controllers and Paired-Surface-Dial
            // Object added or Interfaces Added to an existing Object
            objMgr.on('InterfacesAdded', (objPath, ifacesAndProps) => {
                this.logger.info(`${this.logLabel} Interfaces Added @ ${objPath}: ${JSON.stringify(ifacesAndProps)} `);
            });
            // Object removed or Interfaces Removed from an existing Object
            objMgr.on('InterfacesRemoved', (objPath, ifaces) => {
                this.logger.info(`${this.logLabel} Interfaces Removed @ ${objPath}: ${ifaces} `);
            });
        }
        catch(err) {
            this.logger.error(`${this.logLabel} Exception caught in BluetoothSurfaceDial.init() ${err}`);
        }   
    }

    deInit()
    {
        this.systemBus.disconnect();
    }

    adapterNotRegistered() {
        return (!this.hciObjPath);
    }

    async addAdapter(objPath) {
        if (! this.hciObjPath) {
            // Update instance property
            this.hciObjPath = objPath;
            // Set up monitor on this obj
            try {
                this.hciObj = await this.systemBus.getProxyObject(BluetoothSurfaceDial.BLUEZ_SERVICE, this.hciObjPath);
                const properties = this.hciObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                properties.on('PropertiesChanged', (iface, changed, invalidated) => {
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
                        //  Discovering (Boolean)
                    }
                    catch (err) {
                        this.logger.error(`${this.logLabel} ${this.hciObjPath} PropertiesChanged error: ${err}`);

                    }
                });
            }
            catch (err) {
                this.logger.error(`${this.logLabel} ${this.hciObjPath} setup error. ${err}`);
            }
            // emit signal - found new BT adapter
            this.emit('bt_adapter_available');
        }
    }

    removeAdapter(objPath) {
        // Update instance property
        if (objPath == this.hciObjPath) {
            this.hciObjPath = null;
            // emit signal - BT adapter removed
            this.emit('bt_adapter_removed');
        }
    }

    // busObj: Dictionary <Interface:string, Dictionary<Property:string, Variant>> >
    // return true if it is.
    isBtController(busObj) {
        // Look for the Adapter Interface
        return busObj.hasOwnProperty(BluetoothSurfaceDial.ADAPTER_IFACE_NAME);
    }
  
    // see if the device is a Surface-Dial and it's paired
    // busObj: Dictionary <Interface:string, Dictionary<Property:string, Variant>> >
    // return true if it is.
    isPairedSurfaceDial(busObj) {
        let isSdial = false;
        let isPaired = false;
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
            // Look for Paired property
            if (isSdial && deviceObj.hasOwnProperty('Paired')) {
                isPaired = deviceObj['Paired'].value;
            }
        }
        return (isSdial && isPaired);
    }

    sdialNotRegistered() {
        return (!this.sdialObjPath);
    }

    // add surface dial to class instance
    async addSurfaceDial(objPath) {
        if (!this.sdialObjPath) {
            // Update instance properties
            this.sdialObjPath = objPath;
            // Set up monitor
            try {
                this.sdialObj = await this.systemBus.getProxyObject(BluetoothSurfaceDial.BLUEZ_SERVICE, this.sdialObjPath);
                let properties = this.sdialObj.getInterface(BluetoothSurfaceDial.PROPERTIES_IFACE_NAME);
                properties.on('PropertiesChanged', (iface, changed, invalidated) => {
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
                        //  Connected (Boolean)
                            // emit signal if it is connected or disconnected
                    }
                    catch (err) {
                        this.logger.error(`${this.logLabel} ${this.sdialObjPath} PropertiesChanged error: ${err}`);
                    }
                });
            }
            catch (err) {
                this.logger.error(`${this.logLabel} ${this.sdialObjPath} setup error. ${err}`);
            }
        }
    }
    
    // remove surface dial from class instance
    removeSurfaceDial(objPath) {
        if (this.sdialObjPath == objPath) {
            // Update instance properties
            this.sdialObjPath = null;
            // Remove Monitor
            // emit channel
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
}

module.exports = { BluetoothSurfaceDial };