// Provide sensor data from liquidctl.
import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

export default class LiquidctlUtil extends CommandLineUtil {

    constructor() {
        super();
        const path = GLib.find_program_in_path('liquidctl');
        this._argv = path ? [path, 'status', '--json'] : null;
    }

    // Avoid processing the data more than once.
    execute(callback) {
        super.execute(() => {
            try {
                const output = this._output.join('');
                if (output == '')
                    throw 'no data (liquidctl probably exited with an error)';

                let temp = [];
                let rpm = [];
                let volt = [];

                let dest = null;
                let type = null;

                for (const device of JSON.parse(output)) {
                    // use a shorter device name to reduce visual noise:
                    // - omit manufacturer name
                    // - omit details in parenthesis
                    const shortDevice = device.description.replace(/(^.+? )|( \(.+)/g, '');

                    for (const item of device.status) {
                        switch (item.unit) {
                        case '°C':
                            dest = temp;
                            type = 'temp';
                            break;
                        case 'rpm':
                            dest = rpm;
                            type = 'rpm';
                            break;
                        case 'V':
                            dest = volt;
                            type = 'volt';
                            break;
                        default:
                            continue;
                        }

                        // use a shorter sensor name to reduce visual noise:
                        // - omit temperature|speed|voltage suffix
                        const shortKey = item.key.replace(/ (temperature|speed|voltage)/, '');

                        const feature = {
                            label: shortDevice + ' ' + shortKey,
                            [type]: item.value,
                        };
                        dest.push(feature);
                    }
                }

                this._temp = temp;
                this._rpm = rpm;
                this._volt = volt;
                callback();
            } catch (e) {
                this._temp = null;
                this._rpm = null;
                this._volt = null;
                logError(e, 'failed to process data from liquidctl');
            }
        });
    }

    get temp() {
        return this._temp || [];
    }

    get rpm() {
        return this._rpm || [];
    }

    get volt() {
        return this._volt || [];
    }
};
