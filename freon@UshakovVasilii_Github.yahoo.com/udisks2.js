import Gio from 'gi://Gio';

const UDisksDriveProxy = Gio.DBusProxy.makeProxyWrapper(
'<node> \
    <interface name="org.freedesktop.UDisks2.Drive"> \
        <property type="s" name="Model" access="read"/> \
    </interface> \
</node>');

const UDisksDriveAtaProxy = Gio.DBusProxy.makeProxyWrapper(
'<node> \
    <interface name="org.freedesktop.UDisks2.Drive.Ata"> \
        <property type="d" name="SmartTemperature" access="read"/> \
    </interface> \
</node>');

// Poor man's async.js
const Async = {
    // mapping will be done in parallel
    map(arr, mapClb /* function(in, successClb)) */, resClb /* function(result) */) {
        if (arr.length === 0) {
            resClb([]);
            return;
        }
        let counter = arr.length;
        let result = [];
        for (let i = 0; i < arr.length; ++i) {
            mapClb(arr[i], (function(i, newVal) {
                result[i] = newVal;
                if (--counter == 0) resClb(result);
            }).bind(null, i));
        }
    }
}

// routines for handling of udisks2
export default class UDisks2 {

    constructor(callback) {
        this._udisksProxies = [];
        this._temps = [];
        this._cancellable = new Gio.Cancellable();
        this._destroyed = false;
        this._updated = false;
        this._get_drive_ata_proxies((proxies) => {
            if (this._destroyed) return;
            this._udisksProxies = proxies;
            this._refreshTemps();
            this._updated = true;
            if (callback) callback();
        });
    }

    get available(){
        return this._udisksProxies.length > 0;
    }

    get updated (){
       return this._updated;
    }

    set updated (updated){
        this._updated = updated;
    }

    get temp() {
        return this._temps;
    }

    _refreshTemps() {
        this._temps = this._udisksProxies.filter(function(proxy) {
            // 0K means no data available
            return proxy.ata.SmartTemperature > 0;
        }).map(function(proxy) {
            return {
                label: proxy.drive.Model,
                temp: proxy.ata.SmartTemperature - 273.15
            };
        });
    }

    // calls callback with [{ drive: UDisksDriveProxy, ata: UDisksDriveAtaProxy }, ... ] for every drive that implements both interfaces
    _get_drive_ata_proxies(callback) {
        Gio.DBusObjectManagerClient.new(Gio.DBus.system, 0, "org.freedesktop.UDisks2", "/org/freedesktop/UDisks2", null, this._cancellable, (src, res) => {
            try {
                let objMgr = Gio.DBusObjectManagerClient.new_finish(res); //might throw
                this._objMgr = objMgr;

                let objPaths = objMgr.get_objects().filter(function(o) {
                    return o.get_interface("org.freedesktop.UDisks2.Drive") != null
                        && o.get_interface("org.freedesktop.UDisks2.Drive.Ata") != null;
                }).map(function(o) { return o.get_object_path() });

                // now create the proxy objects, log and ignore every failure
                Async.map(objPaths, (obj, mapCb) => {
                    if (this._destroyed) {
                        mapCb(null);
                        return;
                    }
                    // create the proxies object
                    let driveProxy = new UDisksDriveProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, (res, error) => {
                        if (error) {
                            logError(error, '[FREON] Could not create proxy on ' + obj);
                            mapCb(null);
                            return;
                        }
                        let ataProxy = new UDisksDriveAtaProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, (res, error) => {
                            if (error) {
                                logError(error, '[FREON] Could not create proxy on ' + obj);
                                mapCb(null);
                                return;
                            }

                            mapCb({ drive: driveProxy, ata: ataProxy });
                        }, this._cancellable);
                    }, this._cancellable);
                }, function(proxies) {
                    callback(proxies.filter(function(a) { return a != null; }));
                });
            } catch (e) {
                if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    logError(e, '[FREON] Could not find UDisks2 objects');
                callback([]);
            }
        });
    }

    destroy(callback) {
        this._destroyed = true;
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this._udisksProxies = [];
        this._temps = [];
        this._objMgr = null;
    }

    execute(callback) {
        if (this._destroyed) {
            if (callback) callback();
            return;
        }
        this._refreshTemps();
        this._updated = true;
        if (callback) callback();
    }

}
