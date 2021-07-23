const EventEmitter = require("events");
const dbus = require('dbus-native');

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
        this.hciObjPath = null;
        this.sdialObjPath = null; // only set if it is paired
        this.logger = logger;
        this.logLabel = logLabel;
    }

    // Connect to D-Bus and register for event changes
    init() {
        // Find existing adapter and surface dial
        const systemBus = dbus.systemBus();
        const bluezService = systemBus.getService(BluetoothSurfaceDial.BLUEZ_SERVICE);
        bluezService.getInterface('/', BluetoothSurfaceDial.OBJMANAGER_IFACE_NAME, 
            (err, bluezObjMgr) => {
                if (err) {
                    this.logger.error(`${this.logLabel} Error getting interface \
                    ${BluetoothSurfaceDial.OBJMANAGER_IFACE_NAME} : ${err}`);
                }
                else if (bluezObjMgr) {
                    bluezObjMgr.GetManagedObjects((err, objs) => {
                        // Inspect current Bluetooth Controllers and Paired Surface-Dial
                        if (err) {
                            this.logger.error(`${this.logLabel} Bluez GetManagedObjects: ${err}`);
                        }
                        else {
                            this.logger.info(`${this.logLabel} ${objs.length} managed-objs`);
                            this.logger.debug(`${this.logLabel} Managed Objs: ${JSON.stringify(objs)}`);
                            this.showManagedObjs(objs); // informational
                            objs.forEach((obj, objIdx, objArr) => {
                                // find the first controller
                                if ((this.adapterNotRegistered()) && this.isBtController(obj[1])) {
                                    this.addAdapter(obj[0]);
                                }
                                // find the first Surface Dial
                                if ((this.sdialNotRegistered()) && this.isPairedSurfaceDial(obj[1])) {
                                    this.addSurfaceDial(obj[0]);
                                }
                            });
                            // Handle case where Surface Dial is binded to the first Adapter
                            this.isSurfaceDialAssociatedWithAdapter()
                            .then((isAssociated) => {
                                if (!isAssociated) {
                                    this.logger.error(`${this.logLabel} ${this.sdialObjPath} does not belong to ${this.hciObjPath}`);
                                }
                            })
                            .catch(err => {
                                this.logger.error(`${this.logLabel} Error checking Surface Dial's associated Adapter ${err}`);
                            });
                        }
                        this.logger.info(`[${this.logLabel} init()] Adapter: ${this.hciObjPath}; SurfaceDial: ${this.sdialObjPath}`);
                    });
                    // Monitor changes to Bluetooth Controllers and Paired-Surface-Dial
                    // Object added or Interfaces Added to an existing Object
                    bluezObjMgr.on('InterfacesAdded', (objPath, ifacesAndProps) => {
                        this.logger.info(`${this.logLabel} InterfacesAdded ${objPath}: ${ifacesAndProps} `);
                    });
                    // Object removed or Interfaces Removed from an existing Object
                    bluezObjMgr.on('InterfacesRemoved', (objPath, ifaces) => {
                        this.logger.info(`${this.logLabel} InterfacesAdded ${objPath}: ${ifaces} `);
                    });
                }
                else if (undefined === bluezObjMgr) {
                    this.logger.error(`${this.logLabel} ${BluetoothSurfaceDial.OBJMANAGER_IFACE_NAME} is undefined interface`);
                }
                else {
                    this.logger.error(`${this.logLabel} ${BluetoothSurfaceDial.OBJMANAGER_IFACE_NAME} is null? interface`);
                }
            });
    }

    showManagedObjs(mObjs) {
        mObjs.forEach((mObj, idx, mObjArr) => {
            this.logger.info(`${this.logLabel} [Obj-${idx}] ${mObj[0]}:`);
            // Level-2: Interfaces of each Managed-Obj
            mObj[1].forEach((iface, ifcIdx, ifaceArr) => {
                this.logger.info(`${this.logLabel} \t[Iface-${ifcIdx}] ${iface[0]}`);
                // Level-3: Properties or Functions of each Interface
                iface[1].forEach((funcOrProp, fopIdx, fopArr) => {
                    this.logger.info(`${this.logLabel} \t\t[Func/Prop-${fopIdx}] ${funcOrProp[0]}: ${JSON.stringify(funcOrProp[1])}`);
                });
            });
        });
    }

    adapterNotRegistered() {
        return (!this.hciObjPath);
    }

    addAdapter(objPath) {
        // Update instance property
        this.hciObjPath = objPath;
        // Set up monitor on this obj
        const systemBus = dbus.systemBus();
        const bluezService = systemBus.getService(BluetoothSurfaceDial.BLUEZ_SERVICE);
        bluezService.getInterface(this.hciObjPath, BluetoothSurfaceDial.PROPERTIES_IFACE_NAME,
            (err, properties) => {
                if (err) {

                }
                else {
                    properties.on('PropertiesChanged', (ifaceName, changedProps, invalidatedProps) => {
                        // Interface: Adapter1
                        //  Powered (Boolean)
                            // emit signal if it is turned on or off
                        //  Discovering (Boolean)
                    });
                }
            });
        // emit signal - found new BT adapter
        this.emit('bt_adapter_available');
    }

    removeAdapter(objPath) {
        // Update instance property
        if (objPath == this.hciObjPath) {
            this.hci_obj_path = null;
            // emit signal - BT adapter removed
            this.emit('bt_adapter_removed');
        }
    }

    // ifaces: nested-array of interfaces and its properties/functions
    // return true if it is.
    isBtController(ifaces) {
        // Look for the Adapter Interface
        return (-1 != (ifaces.findIndex(iface => iface[0] == BluetoothSurfaceDial.ADAPTER_IFACE_NAME)));
    }

    // ifaces: nested-array of interfaces and its properties/functions
    // return true if it is.
    isDevice(ifaces) {
        // Look for the Device Interface
        return (-1 != (ifaces.findIndex(iface => iface[0] == BluetoothSurfaceDial.DEVICE_IFACE_NAME)));
    }

    // see if the device is a Surface-Dial and it's paired
    // ifaces: nested-array of interfaces and its properties/functions
    // return true if it is.
    isPairedSurfaceDial(ifaces) {
        let isSdial = false;
        let isPaired = false;
        // Look for the Device Interface
        const deviceIdx = ifaces.findIndex(iface => iface[0] == BluetoothSurfaceDial.DEVICE_IFACE_NAME);
        if (deviceIdx != -1) {
            const deviceProperties = ifaces[deviceIdx][1];
            // Array of properties
            const nameIdx = deviceProperties.findIndex(prop => prop[0] == 'Name');
            if (nameIdx != -1) {
                try {
                    // prop[1] is array of 2 elements: first is the type-definition,
                    // second is value.
                    const nameProp = deviceProperties[nameIdx][1];
                    if (nameProp[1][0] == BluetoothSurfaceDial.SDIAL_NAME)
                        isSdial = true;
                }
                catch (err) {
                    this.logger.error(`Exception caught getting Device Name property. ${err}`);
                }
            }
            else {   
                const aliasIdx = deviceProperties.findIndex(prop => prop[0] == 'Alias');
                if (aliasIdx != -1) {
                    try {
                        const aliasProp = deviceProperties[aliasIdx][1];
                        if (aliasProp[1][0] == BluetoothSurfaceDial.SDIAL_NAME)
                            isSdial = true;
                    }
                    catch (err) {
                        this.logger.error(`Exception caught getting Device Alias property. ${err}`);
                    }
                }
            }
            if (isSdial) {
                const pairedIdx = deviceProperties.findIndex(prop => prop[0] == 'Paired');
                if (pairedIdx != -1) {
                    try {
                        const pairedProp = deviceProperties[pairedIdx][1];
                        isPaired = pairedProp[1][0];
                    }
                    catch (err) {
                        this.logger.error(`Exception caught getting Device Paired property. ${err}`);
                    }
                }
            }
        }
        return (isSdial && isPaired);
    }

    
    sdialNotRegistered() {
        return (!this.sdialObjPath);
    }

    // add surface dial to class instance
    addSurfaceDial(objPath) {
        if (!this.sdialObjPath) {
            // Update instance properties
            this.sdialObjPath = objPath;
            // Set up monitor
            const systemBus = dbus.systemBus();
            const bluezService = systemBus.getService(BluetoothSurfaceDial.BLUEZ_SERVICE);
            bluezService.getInterface(this.sdialObjPath, BluetoothSurfaceDial.PROPERTIES_IFACE_NAME,
                (err, properties) => {
                    if (err) {
                        this.logger.error(`${this.logLabel} Error getting ${this.sdialObjPath} \
                        ${BluetoothSurfaceDial.PROPERTIES_IFACE_NAME} interface : ${err}`);
                    }
                    else {
                        properties.on('PropertiesChanged', (ifaceName, changedProps, invalidatedProps) => {
                            // Interface: Device1
                            //  Paired (Boolean)
                                // emit signal if it is paired or unpaired
                            //  Connected (Boolean)
                                // emit signal if it is connected or disconnected
                        });
                    }
                });
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
        return new Promise((resolve, reject) => {
            let isAssociated = false;
            if (this.sdialObjPath && this.hciObjPath) {
                const systemBus = dbus.systemBus();
                const bluezService = systemBus.getService(BluetoothSurfaceDial.BLUEZ_SERVICE);
                // the Object property getting has a bug. Use the Properties.Get method
                bluezService.getInterface(this.sdialObjPath, BluetoothSurfaceDial.PROPERTIES_IFACE_NAME,
                    (err, properties) => {
                        if (err) {
                            reject(new Error(`${this.logLabel} Error getting ${this.sdialObjPath} 
                            ${BluetoothSurfaceDial.PROPERTIES_IFACE_NAME} interface : ${err}`));
                        }
                        else {
                            try {
                                properties.Get(BluetoothSurfaceDial.DEVICE_IFACE_NAME, 'Adapter',
                                    (err2, adapterProp) => {
                                        if (err2) {
                                            reject(new Error(`${this.logLabel} Error getting ${this.sdialObjPath} 
                                            Adapter property : ${err2}`));
                                        }
                                        else {
                                            this.logger.info(`${this.logLabel} Device1.Adapter = ${adapterProp}`);
                                            isAssociated = (this.hciObjPath == adapterProp[1]);
                                            resolve(isAssociated);
                                        }
                                    });
                            }
                            catch (err) {
                                reject(new Error(`${this.logLabel} 
                                    Exception caught accessing ${BluetoothSurfaceDial.DEVICE_IFACE_NAME}.Adapter
                                     property. ${err}`));
                            }
                        }
                    });
            }
            else {
                resolve(false);
            }
        });
    }
}

module.exports = { BluetoothSurfaceDial };