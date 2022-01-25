const LocalStorage = require('node-localstorage').LocalStorage;

const storagePath = __dirname + '/../../storage';
const localStorage = new LocalStorage(storagePath);

function onCachePutFail(e) {
    console.log(e);
}

function updateCache(instance) {
    const cache = instance.cache;
    if (cache) {
        cache.put('data', new Response(JSON.stringify(instance.localData))).catch(onCachePutFail);
    }
}

function onCacheOpened(result) {
    this.cache = result;
    this.localData = {};
}

class AppStore {
    constructor() {
        const self = this;
        try {
            if (self && self.caches) {
                caches.open('embydata').then(onCacheOpened.bind(this));
            }
        } catch (err) {
            console.log(`Error opening cache: ${err}`);
        }
    }

    setItem(name, value) {
        localStorage.setItem(name, value);
        const localData = this.localData;
        if (localData) {
            const changed = localData[name] !== value;
            if (changed) {
                localData[name] = value;
                updateCache(this);
            }
        }
    }

    static getInstance() {
        if (!AppStore.instance) {
            AppStore.instance = new AppStore();
        }

        return AppStore.instance;
    }

    getItem(name) {
        return localStorage.getItem(name);
    }

    removeItem(name) {
        localStorage.removeItem(name);
        const localData = this.localData;
        if (localData) {
            localData[name] = null;
            delete localData[name];
            updateCache(this);
        }
    }
}

module.exports = AppStore.getInstance();
