const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const CommandLineUtil = Me.imports.commandLineUtil;

var NvidiaUtil = class extends CommandLineUtil.CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('nvidia-smi');
        this._argv = path ? [path, '--query-gpu=name,temperature.gpu', '--format=csv,noheader'] : null;
    }

    get temp() {
        let gpus = [];

        if (this._output) {
            for (let line of this._output) {
                let values = line.split(',');
                if (values.length < 2)
                    continue;

                let label = values[0].trim();
                let temp = parseFloat(values[1]);

                if(!label || !temp)
                    continue;

                gpus.push({ label: label, temp: temp });
            }
        }

        return gpus;
    }

};
