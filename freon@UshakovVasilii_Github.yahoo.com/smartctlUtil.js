import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SMARTCTL = GLib.find_program_in_path('smartctl');

function spawnJsonSync(args) {
    if (!SMARTCTL)
        return null;
    let proc = Gio.Subprocess.new([SMARTCTL, ...args, '-j'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    let [, stdout] = proc.communicate_utf8(null, null);
    return JSON.parse(stdout);
}

function spawnJsonAsync(args, cb) {
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
    proc.communicate_utf8_async(null, null, (p, res) => {
        try {
            let [, stdout] = p.communicate_utf8_finish(res);
            cb(JSON.parse(stdout));
        } catch (e) {
            logError(e, '[FREON] smartctl parse failed');
            cb(null);
        }
    });
}

export default class SmartctlUtil {

    constructor(callback) {
        this._smartDevices = [];
        this._temps = [];
        try {
            this._smartDevices = spawnJsonSync(["--scan"])["devices"];
        } catch (e) {
            logError(e, '[FREON] Unable to find smart devices');
        }
        this._updated = true;
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
        this._smartDevices = [];
        this._temps = [];
    }

    execute(callback) {
        if (this._smartDevices.length === 0) {
            this._updated = true;
            if (callback) callback();
            return;
        }

        let pending = this._smartDevices.length;
        let results = [];
        const finishOne = (entry) => {
            if (entry) results.push(entry);
            if (--pending === 0) {
                this._temps = results;
                this._updated = true;
                if (callback) callback();
            }
        };

        for (let device of this._smartDevices) {
            spawnJsonAsync(["--info", device.name], (info) => {
                if (!info || info.smartctl.exit_status != 0) {
                    finishOne(null);
                    return;
                }
                spawnJsonAsync(["--attributes", device.name], (attrs) => {
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

};
