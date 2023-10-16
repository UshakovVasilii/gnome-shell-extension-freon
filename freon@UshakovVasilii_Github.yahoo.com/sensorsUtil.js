import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

export default class SensorsUtil extends CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('sensors');
        // -A: Do not show adapter -j: JSON output
        this._argv = path ? [path, '-A', '-j'] : null;
    }

    // Avoid parsing the data more than once.
    execute(callback) {
        super.execute(() => {
            let data = [];
            try {
                data = JSON.parse(this._output.join(''));
            } catch (e) {
                try {
                    // fix for wrong lm_sensors output
                    // https://github.com/UshakovVasilii/gnome-shell-extension-freon/issues/114#issuecomment-491613545
                    let lineRemoved = this._output.filter(l => l.trim() !== ',').join('\n');
                    let errorRemoved = lineRemoved.replace(/ERROR.*Can't read/, "");
                        errorRemoved = errorRemoved.replace(/ERROR.*I\/O error/, "");
                        data = JSON.parse(errorRemoved);
                } catch (e) {
                    logError(e);
                    return [];
                }
            }
            this._data = data;
            callback();
        });
    }

    get temp() {
        return this._parseSensorsOutput(/^temp\d+_input/, 'temp', 'generic');
    }

    get gpu() {
        return this._parseSensorsOutput(/^temp\d+_input/, 'temp', 'gpu');
    }

    get disks() {
        return this._parseSensorsOutput(/^temp\d+_input/, 'temp', 'disk');
    }

    get rpm() {
        return this._parseSensorsOutput(/^fan\d+_input/, 'rpm', 'generic');
    }

    get volt() {
        return this._parseSensorsOutput(/^in\d+_input/, 'volt', 'generic');
    }

    get power() {
        return this._parseSensorsOutput(/^power\d+_average/, 'power', 'gpu');
    }

  _parseSensorsOutput(sensorFilter, sensorType, sensorFamily) {
        if(!this._data)
            return [];

        const data = this._data;

        let sensors = [];
        for (var chipset in data) {
            let tempType = (sensorType === 'temp')
            let powerType = (sensorType === 'power')

            let gpuFilter = /(radeon|amdgpu|nouveau)/;
            let gpuFamily = (sensorFamily === 'gpu')

            if (!data.hasOwnProperty(chipset) || (gpuFamily != gpuFilter.test(chipset) && (tempType || powerType)))
                continue;

            let diskFilter = /(drivetemp|nvme)/;
            let diskFamily = (sensorFamily === 'disk')
            if (!data.hasOwnProperty(chipset) || (diskFamily != diskFilter.test(chipset) && tempType))
                continue;

            let chipsetSensors = data[chipset]
            for (var sensor in chipsetSensors) {
                if (!chipsetSensors.hasOwnProperty(sensor))
                    continue;

                let fields = chipsetSensors[sensor];
                for (var key in fields) {
                    if (fields.hasOwnProperty(key) && sensorFilter.test(key)) {
                        let feature = {
                            label: sensor,
                            [sensorType]: parseFloat(fields[key])
                        };
                        sensors.push(feature);
                        break;
                    }
                }
            }
        }
        return sensors;
    }
};
