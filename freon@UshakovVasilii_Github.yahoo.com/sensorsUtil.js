import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

const TEMP_RE = /^temp\d+_input/;
const FAN_RE = /^fan\d+_input/;
const VOLT_RE = /^in\d+_input/;
const POWER_RE = /^power\d+_average/;
const GPU_CHIPSET_RE = /(radeon|amdgpu|nouveau)/;
const DISK_CHIPSET_RE = /(drivetemp|nvme)/;

const EMPTY_GROUPS = Object.freeze({
    temp: [],
    gpu: [],
    disks: [],
    rpm: [],
    volt: [],
    power: [],
});

export default class SensorsUtil extends CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('sensors');
        // -A: Do not show adapter -j: JSON output
        this._argv = path ? [path, '-A', '-j'] : null;
        this._groups = EMPTY_GROUPS;
    }

    execute(callback) {
        super.execute(() => {
            let data = null;
            try {
                data = JSON.parse(this._output.join(''));
            } catch (e) {
                try {
                    // fix for wrong lm_sensors output
                    // https://github.com/UshakovVasilii/gnome-shell-extension-freon/issues/114#issuecomment-491613545
                    let lineRemoved = this._output.filter(l => l.trim() !== ',').join('\n');
                    let errorRemoved = lineRemoved.replace(/ERROR.*Can't read/, "");
                    errorRemoved = errorRemoved.replace(/ERROR.*I\/O error/, "");
                    errorRemoved = errorRemoved.replace(/NaN/g, "0");
                    data = JSON.parse(errorRemoved);
                } catch (e2) {
                    logError(e2);
                    this._groups = EMPTY_GROUPS;
                    callback();
                    return;
                }
            }
            this._groups = this._buildGroups(data);
            callback();
        });
    }

    _buildGroups(data) {
        const groups = { temp: [], gpu: [], disks: [], rpm: [], volt: [], power: [] };

        for (const chipset in data) {
            if (!data.hasOwnProperty(chipset))
                continue;

            const isGpu = GPU_CHIPSET_RE.test(chipset);
            const isDisk = DISK_CHIPSET_RE.test(chipset);
            const chipsetSensors = data[chipset];

            for (const sensor in chipsetSensors) {
                if (!chipsetSensors.hasOwnProperty(sensor))
                    continue;

                const fields = chipsetSensors[sensor];

                for (const key in fields) {
                    if (!fields.hasOwnProperty(key))
                        continue;

                    if (TEMP_RE.test(key)) {
                        const entry = { label: sensor, temp: parseFloat(fields[key]) };
                        if (isGpu) groups.gpu.push(entry);
                        else if (isDisk) groups.disks.push(entry);
                        else groups.temp.push(entry);
                        break;
                    }
                    if (FAN_RE.test(key)) {
                        groups.rpm.push({ label: sensor, rpm: parseFloat(fields[key]) });
                        break;
                    }
                    if (VOLT_RE.test(key)) {
                        groups.volt.push({ label: sensor, volt: parseFloat(fields[key]) });
                        break;
                    }
                    if (POWER_RE.test(key) && isGpu) {
                        groups.power.push({ label: sensor, power: parseFloat(fields[key]) });
                        break;
                    }
                }
            }
        }

        return groups;
    }

    get temp()  { return this._groups.temp; }
    get gpu()   { return this._groups.gpu; }
    get disks() { return this._groups.disks; }
    get rpm()   { return this._groups.rpm; }
    get volt()  { return this._groups.volt; }
    get power() { return this._groups.power; }
}
