import GLib from 'gi://GLib';

import CommandLineUtil from './commandLineUtil.js';

export default class AticonfigUtil extends CommandLineUtil {

    constructor() {
        super();
        let path = GLib.find_program_in_path('aticonfig');
        this._argv = path ? [path, '--odgt'] : null;
    }

    /*
    Default Adapter - AMD Radeon R9 200 Series     
                  Sensor 0: Temperature - 37.00 C
    */
    get temp() {
        if (!this._output)
            return [];
        let label = null;
        let temp = null;
        for (let line of this._output) {
            if (!line)
                continue;
            let r;
            if (line.indexOf('Adapter') > 0) {
                r = /Adapter \- (.*)/.exec(line);
                if (r) label = r[1];
            }
            if (line.indexOf('Temperature') > 0) {
                r = /Temperature\s*-\s*([\d.]+)/.exec(line);
                if (r) temp = parseFloat(r[1]);
            }
        }

        if (!label || !Number.isFinite(temp))
            return [];

        return [{ label: label.trim(), temp: temp }];
    }

}
