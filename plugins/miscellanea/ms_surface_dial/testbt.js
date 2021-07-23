const dbus = require('dbus-native');

let sysbus = dbus.systemBus();
let bluez = sysbus.getService('org.bluez');
bluez.getInterface('/', 'org.freedesktop.DBus.ObjectManager', (err, om) => {
    console.log('Hello OM!');
    console.log(err, om);
    if (om) {
        om.GetManagedObjects((err, objs) => {
            console.log(`Error: ${err}, Managed Objs: ${JSON.stringify(objs)}`);
            // It's a arrays of arrays
            // Level-1: Managed-Objs
            objs.forEach((mObj, idx, mObjArr) => {
                // objPath
                console.log(`[Obj-${idx}] ${mObj[0]}:`);
                // Level-2: Interfaces of each Managed-Obj
                mObj[1].forEach((iface, ifcIdx, ifaceArr) => {
                    console.log(`\t[Iface-${ifcIdx}] ${iface[0]}`);
                    // Level-3: Properties or Functions of each Interface
                    iface[1].forEach((funcOrProp, fopIdx, fopArr) => {
                        console.log(`\t\t[Func/Prop-${fopIdx}] ${funcOrProp[0]}: ${JSON.stringify(funcOrProp[1])}`);
                    });
                });
            });
        })
    }
    console.log('Bye!');
});
bluez.getInterface('/', 'org.freedesktop.DBus.Properties', (err, props) => {
    console.log('Hello Props!');
    console.log(err, props);
    console.log('Bye!');
});
bluez.getInterface('/org/bluez', 'org.bluez.AgentManager1', (err, am1) => {
    console.log('Hello AgentManager1!');
    console.log(err, am1);
    console.log('Bye!');
});
/*
bluez.getInterface('/org/bluez/hci0', 'org.bluez.Adapter1', (err, adp1) => {
    console.log('Hello Adapter1!');
    console.log(err, adp1);
    if (!err) {
        if (false) {
            adp1.Powered((err2,val) => {
                if (err2) {
                    console.error(`Error getting Powered property: ${err2}`);
                }
                else {
                    console.log(`Powered property value: ${val}`);
                }
            });
        }
        else {
            console.log(`Powered: ${adp1.Powered}`);
        }
       
    }
    console.log('Bye!');
});
*/
try {
    bluez.getInterface('/org/bluez/hci0', 'org.freedesktop.DBus.Properties', (err, properties) => {
        if (!err) {
            properties.Get('org.bluez.Adapter1', 'Powered', (err2, value) => {
                console.log('Properties Get returns...');
                if(err2) {
                    console.error(err2);
                }
                else {
                    console.log(`Powered: ${value[1]}`); // value[0] is the object describing value-type.
                }
            })
        }
        else {
            console.error('Error getting Properties interface of hci0', err);
        }
    });
}
catch (ex) {
    console.error('Exception caught getting Powered property.');
    console.error(ex);

}

console.log('Last Line');




