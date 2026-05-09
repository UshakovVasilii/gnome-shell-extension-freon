import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

function spawnAsync(argv, cancellable, cb) {
    let proc;
    try {
        proc = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    } catch (e) {
        cb({ ok: false, status: -1, stdout: '' });
        return;
    }
    proc.communicate_utf8_async(null, cancellable, (p, res) => {
        try {
            let [, stdout] = p.communicate_utf8_finish(res);
            cb({ ok: proc.get_successful(), status: proc.get_exit_status(), stdout: stdout || '' });
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, '[FREON] hddtemp probe failed');
            cb({ ok: false, status: -1, stdout: '' });
        }
    });
}

export default class HddtempUtil extends CommandLineUtil {

    constructor() {
        super();
        this._sep = ': ';
        this._probe();
    }

    _probe() {
        const hddtempPath = GLib.find_program_in_path('hddtemp');
        if (hddtempPath) {
            // check if this user can run hddtemp directly.
            spawnAsync([hddtempPath], this._cancellable, (res) => {
                if (this._destroyed) return;
                if (res.status === 0) {
                    this._argv = [hddtempPath];
                    this._sep = ': ';
                    return;
                }
                this._probeDaemon();
            });
        } else {
            this._probeDaemon();
        }
    }

    _probeDaemon() {
        // doesn't seem to be the case… is it running as a daemon?
        const systemctl = GLib.find_program_in_path('systemctl');
        const pidof = GLib.find_program_in_path('pidof');
        const nc = GLib.find_program_in_path('nc');
        if (!nc) return;

        const finalize = (pid) => {
            if (this._destroyed || !pid) return;
            // get daemon command line
            let port = 7634;
            try {
                let [ok, cmdlineBytes] = GLib.file_get_contents('/proc/' + pid + '/cmdline');
                if (ok) {
                    let cmdline = new TextDecoder().decode(cmdlineBytes);
                    let match = /(-p\W*|--port=)(\d{1,5})/.exec(cmdline);
                    if (match) port = parseInt(match[2]);
                }
            } catch (e) {
                // ignore; use default port
            }
            this._argv = [nc, 'localhost', port.toString()];
            this._sep = '|';
        };

        if (systemctl) {
            spawnAsync([systemctl, 'show', 'hddtemp.service', '-p', 'ActiveState'], this._cancellable, (res) => {
                if (this._destroyed) return;
                if (res.stdout.trim() === 'ActiveState=active') {
                    spawnAsync([systemctl, 'show', 'hddtemp.service', '-p', 'MainPID'], this._cancellable, (res2) => {
                        if (this._destroyed) return;
                        let parts = res2.stdout.trim().split('=');
                        let pid = parts.length === 2 ? Number(parts[1]) : 0;
                        if (pid) {
                            finalize(pid);
                        } else if (pidof) {
                            spawnAsync([pidof, 'hddtemp'], this._cancellable, (r) => {
                                if (this._destroyed) return;
                                let p = Number(r.stdout.trim());
                                if (p) finalize(p);
                            });
                        }
                    });
                } else if (pidof) {
                    spawnAsync([pidof, 'hddtemp'], this._cancellable, (r) => {
                        if (this._destroyed) return;
                        let p = Number(r.stdout.trim());
                        if (p) finalize(p);
                    });
                }
            });
        } else if (pidof) {
            spawnAsync([pidof, 'hddtemp'], this._cancellable, (r) => {
                if (this._destroyed) return;
                let p = Number(r.stdout.trim());
                if (p) finalize(p);
            });
        }
    }

    get temp() {
        if (!this._output)
            return [];

        const sep = this._sep;
        let hddtempOutput = [];
        if (this._output.join().indexOf(sep + sep) > 0) {
            hddtempOutput = this._output.join().split(sep + sep);
        } else {
            hddtempOutput = this._output;
        }

        let sensors = [];
        for (let line of hddtempOutput) {
            let fields = line.split(sep).filter(function(e) { return e; });
            if (fields.length < 3) continue;
            let sensor = { label: fields[1], temp: parseFloat(fields[2]) };
            //push only if the temp is a Number
            if (!isNaN(sensor.temp))
                sensors.push(sensor);
        }

        return sensors;
    }

}
