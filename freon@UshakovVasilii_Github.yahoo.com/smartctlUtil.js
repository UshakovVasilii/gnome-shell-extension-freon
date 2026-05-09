import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SMARTCTL = GLib.find_program_in_path('smartctl');

function spawnJsonAsync(args, cancellable, cb) {
    if (!SMARTCTL) {
        cb(null);
        return;
    }
    let proc;
    try {
        proc = Gio.Subprocess.new([SMARTCTL, ...args, '-j'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    } catch (e) {
        logError(e, '[FREON] smartctl spawn failed');
        cb(null);
        return;
    }
    proc.communicate_utf8_async(null, cancellable, (p, res) => {
        try {
            let [, stdout] = p.communicate_utf8_finish(res);
            cb(JSON.parse(stdout));
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, '[FREON] smartctl parse failed');
            cb(null);
        }
    });
}

export default class SmartctlUtil {

    constructor(callback) {
        this._smartDevices = [];
        this._temps = [];
        this._updated = true;
        this._destroyed = false;
        this._gen = 0;
        this._cancellable = new Gio.Cancellable();

        if (SMARTCTL) {
            spawnJsonAsync(["--scan"], this._cancellable, (data) => {
                if (this._destroyed) return;
                if (data && data.devices)
                    this._smartDevices = data.devices;
                this._updated = true;
                if (callback) callback();
            });
        }
    }

    get available(){
        return this._smartDevices.length > 0;
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

    destroy(callback) {
        this._destroyed = true;
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this._smartDevices = [];
        this._temps = [];
    }

    execute(callback) {
        if (this._destroyed || this._smartDevices.length === 0) {
            this._updated = true;
            if (callback) callback();
            return;
        }

        const gen = ++this._gen;
        let pending = this._smartDevices.length;
        let results = [];
        const finishOne = (entry) => {
            if (entry) results.push(entry);
            if (--pending === 0) {
                if (this._destroyed) return;
                if (gen === this._gen)
                    this._temps = results;
                this._updated = true;
                if (callback) callback();
            }
        };

        for (let device of this._smartDevices) {
            spawnJsonAsync(["--info", device.name], this._cancellable, (info) => {
                if (this._destroyed) { finishOne(null); return; }
                if (!info || info.smartctl.exit_status != 0) {
                    finishOne(null);
                    return;
                }
                spawnJsonAsync(["--attributes", device.name], this._cancellable, (attrs) => {
                    if (this._destroyed) { finishOne(null); return; }
                    if (!attrs || attrs.smartctl.exit_status != 0 || !attrs.temperature) {
                        finishOne(null);
                        return;
                    }
                    finishOne({
                        label: info.model_name,
                        temp: parseFloat(attrs.temperature.current)
                    });
                });
            });
        }
    }

}
