import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export default class NvidiaUtil {

    constructor() {
        this._nvidiaSmiPath = GLib.find_program_in_path('nvidia-smi');
        this._updated = false;
        this._gpuInfo = {};
        this._output = [];
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
            let gpuInfo = {};
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
                const prevGpuInfo = this._gpuInfo[gpu] || {};
                if (contentsString.split('\n')[1].endsWith('Off') && prevGpuInfo.output) {
                    gpuInfo[gpu] = { output: prevGpuInfo.output.split(',')[0] + ',N/A' };
                    continue;
                }

                // If the GPU needs time to sleep, then keep showing the old temperature.
                // Since even process monitoring prevents sleep, we don't check && sleepEligible :/
                if ((prevGpuInfo.skipUntil || 0) > Date.now()) {
                    gpuInfo[gpu] = prevGpuInfo;
                    continue;
                }
                
                // Poll the GPU.
                gpuInfo[gpu] = { output: await this.getGpuInfo(gpu) };
                
                // If runtime D3 is enabled and the GPU is eligible to sleep...
                try {
                    const sleepEligible = await this.isGpuEligibleToSleep(gpu);
                    if (contentsString.split('\n')[0].includes('Enabled') && sleepEligible) {
                        // ...skip polling it for 30 seconds.
                        gpuInfo[gpu].skipUntil = Date.now() + 30000;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            this._gpuInfo = gpuInfo;
            this._output = Object.keys(this._gpuInfo)
                .sort()
                .map(gpu => gpuInfo[gpu].output)
                .filter(output => !!output);
        } catch (e) {
            console.error(e);
        } finally {
            callback();
            this._updated = true;
        }
    }

    isGpuEligibleToSleep(id) {
        return new Promise((resolve, reject) => {
            let proc = Gio.Subprocess.new(
                [this._nvidiaSmiPath, 'pmon', '--count=1', `--id=${id}`],
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, (proc, result) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(result);
                    const processes = stdout ? stdout.trim().split('\n').slice(2) : [];
                    if (processes.length === 1) {
                        const process = processes[0].toLowerCase().split(' ').pop().replace(/-?server/, '');
                        resolve(process === 'xorg' || process === 'x' || process === 'x11' || // X11
                            process === 'gnome-shell'); // Wayland
                    } else {
                        resolve(processes.length === 0);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    getGpuInfo(id) {
        return new Promise((resolve, reject) => {
            let proc = Gio.Subprocess.new(
                [this._nvidiaSmiPath, '--query-gpu=name,temperature.gpu', '--format=csv,noheader', `--id=${id}`],
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, (proc, result) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(result);
                    resolve(stdout ? stdout.trim() : '');
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    get temp() {
        let gpus = [];

        if (this._output) {
            for (let line of this._output) {
                let values = line.split(',');
                if (values.length < 2)
                    continue;

                let label = values[0].trim();
                let temp = values[1] === 'N/A' ? null : parseFloat(values[1]);

                if(!label || isNaN(temp))
                    continue;

                gpus.push({ label: label, temp: temp });
            }
        }

        return gpus;
    }

    get available() {
        return !!this._nvidiaSmiPath;
    }

    get updated() {
        return this._updated;
    }

    set updated(updated) {
        this._updated = updated;
    }

    destroy(callback) {
        this._gpuInfo = {};
        this._output = [];
    }
};
