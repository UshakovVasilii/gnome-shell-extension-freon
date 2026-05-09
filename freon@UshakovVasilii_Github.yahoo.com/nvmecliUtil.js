import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const NVME = GLib.find_program_in_path('nvme');

function spawnJsonAsync(args, cancellable, cb) {
    if (!NVME) {
        cb(null);
        return;
    }
    let proc;
    try {
        proc = Gio.Subprocess.new([NVME, ...args, '-o', 'json'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    } catch (e) {
        logError(e, '[FREON] nvme spawn failed');
        cb(null);
        return;
    }
    proc.communicate_utf8_async(null, cancellable, (p, res) => {
        try {
            let [, stdout] = p.communicate_utf8_finish(res);
            cb(JSON.parse(stdout));
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, '[FREON] nvme parse failed');
            cb(null);
        }
    });
}

export default class NvmecliUtil {

    constructor(callback) {
        this._nvmeDevices = [];
        this._sensors = [];
        this._updated = true;
        this._destroyed = false;
        this._gen = 0;
        this._cancellable = new Gio.Cancellable();

        if (NVME) {
            spawnJsonAsync(["list"], this._cancellable, (data) => {
                if (this._destroyed) return;
                if (data && data.Devices)
                    this._nvmeDevices = data.Devices;
                this._updated = true;
                if (callback) callback();
            });
        }
    }

    get available(){
        return this._nvmeDevices.length > 0;
    }

    get updated (){
       return this._updated;
    }

    set updated (updated){
        this._updated = updated;
    }

    get temp() {
        return this._sensors;
    }

    destroy(callback) {
        this._destroyed = true;
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this._nvmeDevices = [];
        this._sensors = [];
    }

    execute(callback) {
        if (this._destroyed || this._nvmeDevices.length === 0) {
            this._updated = true;
            if (callback) callback();
            return;
        }

        const gen = ++this._gen;
        let pending = this._nvmeDevices.length;
        let results = [];
        const finishOne = (entries) => {
            if (entries) results.push(...entries);
            if (--pending === 0) {
                if (this._destroyed) return;
                if (gen === this._gen)
                    this._sensors = results;
                this._updated = true;
                if (callback) callback();
            }
        };

        for (let device of this._nvmeDevices) {
            spawnJsonAsync(["smart-log", device.DevicePath], this._cancellable, (log) => {
                if (this._destroyed) { finishOne(null); return; }
                if (!log) {
                    finishOne(null);
                    return;
                }
                if (log.hasOwnProperty('temperature_sensor_2')) {
                    finishOne([
                        { label: device.ModelNumber + " S1",
                          temp: parseFloat(log.temperature_sensor_1) - 273.15 },
                        { label: device.ModelNumber + " S2",
                          temp: parseFloat(log.temperature_sensor_2) - 273.15 }
                    ]);
                } else {
                    finishOne([{
                        label: device.ModelNumber,
                        temp: parseFloat(log.temperature) - 273.15
                    }]);
                }
            });
        }
    }

}
