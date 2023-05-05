const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const CommandLineUtil = Me.imports.commandLineUtil;

var NvidiaUtil = class extends CommandLineUtil.CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('nvidia-smi');
        this._argv = path ? [
            '/bin/sh',
            '-c',
            `${path} --query-gpu=name,temperature.gpu --format=csv,noheader`
        ] : null;
    }

    async execute(callback) {
        try {
            // Read all GPUs from /proc/driver/nvidia/gpus.
            const directory = Gio.File.new_for_path('/proc/driver/nvidia/gpus');
            const iter = await new Promise((resolve, reject) => {
                directory.enumerate_children_async(
                    'standard::*',
                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (file_, result) => {
                        try {
                            resolve(directory.enumerate_children_finish(result));
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });
            const gpus = []
    
            while (true) {
                const infos = await new Promise((resolve, reject) => {
                    iter.next_files_async(10, GLib.PRIORITY_DEFAULT, null, (iter_, res) => {
                        try {
                            resolve(iter.next_files_finish(res));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
    
                if (infos.length === 0)
                    break;
    
                for (const info of infos)
                    gpus.push(info.get_name());
            }
    
            // For each GPU...
            let gpusToPoll = ''
            for (const gpu of gpus) {
                // ...read /proc/driver/nvidia/gpus/<ID>/power and check if it supports sleep.
                const file = Gio.File.new_for_path(`/proc/driver/nvidia/gpus/${gpu}/power`);
                const [, contents, etag] = await new Promise((resolve, reject) => {
                    file.load_contents_async(null, (file_, result) => {
                        try {
                            resolve(file.load_contents_finish(result));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
    
                // If the GPU is sleeping, don't poll it.
                const decoder = new TextDecoder('utf-8');
                const contentsString = decoder.decode(contents);
                if (!contentsString.split('\n')[1].endsWith('Off')) {
                    gpusToPoll += `${gpu} `
                }
            }
    
            // Set the argv to poll awake GPUs only.
            let path = GLib.find_program_in_path('nvidia-smi');
            this._argv[2] = `for id in ${gpusToPoll} ; do ${path} ` +
                '--query-gpu=name,temperature.gpu,display_mode --format=csv,noheader --id=$id ; done';
            super.execute(callback);
        } catch (e) {
            console.error(e);
        }
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
