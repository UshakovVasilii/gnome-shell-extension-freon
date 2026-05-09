import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import CommandLineUtil from './commandLineUtil.js';

export default class BumblebeeNvidiaUtil extends CommandLineUtil {

    constructor() {
        super();
        // optirun nvidia-smi -q -d TEMPERATURE
        this._path = GLib.find_program_in_path('optirun');
        this._argv = this._path ? [this._path, 'nvidia-smi', '-q', '-d', 'TEMPERATURE'] : null;

        // original source here:
        // https://github.com/meden/gse-bumblebee-indicator
        // thank meden!
        let virtualDisplay = ':8';

        let bumblebeeConfPath = '/etc/bumblebee/bumblebee.conf';
        if (GLib.file_test(bumblebeeConfPath, GLib.FileTest.EXISTS)) {
            let configFile = Gio.File.new_for_path(bumblebeeConfPath);
            let [ok, contents] = configFile.load_contents(null);
            if (ok) {
                let text = new TextDecoder().decode(contents);
                let m = /^VirtualDisplay=(.*)$/m.exec(text);
                if (m) virtualDisplay = m[1].trim();
            }
        }
        let lockFilePath = '/tmp/.X' + virtualDisplay + '-lock';
        this._lockMonitor = Gio.File.new_for_path(lockFilePath)
            .monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._lockMonitor.id = this._lockMonitor.connect(
            'changed', this._statusChanged.bind(this)
        );

        // Check if the lock file already exists
        // (needed when NVIDIA card is already in use at that point)
        if (GLib.file_test(lockFilePath, GLib.FileTest.EXISTS)) {
            this._detectLabel();
            this._active = true;
        }
    }

    _detectLabel() {
        if (!this._path)
            return;
        // optirun nvidia-smi -L
        // GPU 0: GeForce GT 525M (UUID: GPU-...)
        let proc;
        try {
            proc = Gio.Subprocess.new([this._path, 'nvidia-smi', '-L'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            logError(e, '[FREON] optirun nvidia-smi -L spawn failed');
            return;
        }
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                let [, stdout] = p.communicate_utf8_finish(res);
                for (let line of (stdout || '').split('\n')) {
                    let match = /.*GPU [\d]:([\w\d\ ]+).*/.exec(line);
                    if (match) {
                        this._label = match[1].trim();
                        break;
                    }
                }
            } catch (e) {
                logError(e, '[FREON] optirun nvidia-smi -L parse failed');
            }
        });
    }

    _statusChanged(monitor, a_file, other_file, event_type) {
        if (event_type == Gio.FileMonitorEvent.CREATED) {
            if (this._argv && !this._label)
                this._detectLabel();
            this._active = true;
        } else if (event_type == Gio.FileMonitorEvent.DELETED) {
            this._active = false;
        }
    }

    execute(callback) {
        if (this._active) {
            super.execute(callback);
        } else {
            this._output = [];
            this._updated = true;
            if (callback) callback();
        }
    }

    get temp() {
        let key = 'bumblebee-nvidia';
        let label = this._label ? this._label : _('Bumblebee + NVIDIA');
        if (this._active && this._output) {
            //         GPU Current Temp            : 37 C
            for (let line of this._output) {
                if (!line)
                    continue;
                let r;
                if (line.indexOf('GPU Current Temp') > 0)
                    return [{
                        label: key,
                        temp: (r = /[\s]*GPU Current Temp[\s]*:[\s]*(\d{1,3}).*/.exec(line)) ? parseFloat(r[1]) : null,
                        displayName: label
                    }];
            }
        }
        return [{ label: key, temp: null, displayName: label }];
    }

    destroy() {
        super.destroy();
        if (this._lockMonitor) {
            try {
                if (this._lockMonitor.id)
                    this._lockMonitor.disconnect(this._lockMonitor.id);
            } catch (e) {
                // ignore
            }
            this._lockMonitor.cancel();
            this._lockMonitor = null;
        }
    }

}
