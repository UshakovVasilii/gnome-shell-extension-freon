import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

export default class FreeipmiUtil extends CommandLineUtil {

    constructor(exec_method) {
        super();

        const path = GLib.find_program_in_path('ipmi-sensors');
        // --comma-separated-output: pseudo csv output format, splitting on comma may be good enough for the values we read.
        this._argv = path ? [path, '--comma-separated-output'] : null;

        if (this._argv && exec_method === 'sudo')
        {
            const pkexec_path = GLib.find_program_in_path('pkexec');
            this._argv = pkexec_path ? [pkexec_path].concat(this._argv) : null;
        }
    }

    // Avoid parsing the data more than once.
    execute(callback) {
        super.execute(() => {
            let data = [];

            for (const line of this._output) {
                if (!line)
                    continue;

                const value_list = line.split(',');

                if (value_list.length <= 1)
                    break;

                const id = value_list[0];

                if (id === 'ID')
                    continue;

                const name = value_list[1];
                const value = value_list[3];
                const unit = value_list[4];

                if (value !== 'N/A' && unit !== 'N/A') {
                    data[name] = {};
                    data[name]["value"] = value;
                    data[name]["unit"] = unit;
                }
            }

            this._data = data;
            callback();
        });
    }

    get temp() {
        return this._parseSensorsOutput(/^(C|C per minute)$/, 'temp');
    }

    get rpm() {
        return this._parseSensorsOutput(/^RPM$/, 'rpm');
    }

    get volt() {
        return this._parseSensorsOutput(/^V$/, 'volt');
    }

  _parseSensorsOutput(sensorFilter, sensorType) {
        if(!this._data)
            return [];

        const data = this._data;

        let sensors = [];
        for (const name in data) {
            if (!data.hasOwnProperty(name))
                continue;

            const value = data[name]["value"]
            const unit = data[name]["unit"]

            if (!sensorFilter.test(unit))
                continue;

            const feature = {
                label: name,
                [sensorType]: parseFloat(value)
            };

            sensors.push(feature);
        }

        return sensors;
    }
};
