import Gio from 'gi://Gio';
import GLib from 'gi://GLib';


export default class BatteryUtil {

    constructor() {
        this._bat_path = [];    // Filesystem paths to batteries
        this._updated = false;
        this._find_batteries();
        this._updated = true;
    }

    get available(){
        return (this._bat_path[0]) ? true : false;
    }

    get updated() {
        return this._updated;
    }

    set updated(updated) {
        this._updated = updated;
    }

    get energy() {
        let features = []
        this._bat_path.forEach((bat_path) => {
            let energy = parseFloat(this._get_sensor_data(bat_path, "energy_now"));
            energy /= 1000000.00;

            let bat_name = bat_path.split('/').pop();
            let feature = {
                label: bat_name + " Energy",
                ["power"]: energy
            };
            features.push(feature);
        });
        return features;
    }

    get power() {
        let features = [];
        this._bat_path.forEach((bat_path) => {
            let power = parseFloat(this._get_sensor_data(bat_path, "power_now"));
            power /= 1000000.00;

            let state = this._get_sensor_data(bat_path, "status");
            if (state && state.startsWith("Dis"))
                power *= -1;

            let bat_name = bat_path.split('/').pop();
            let feature = {
                label: bat_name + " Power",
                ["power"]: power
            };
            features.push(feature);
        })
        return features;
    }

    get voltage() {
        let features = [];
        this._bat_path.forEach((bat_path) => {
            let voltage = parseFloat(this._get_sensor_data(bat_path, "voltage_now"));
            voltage /= 1000000.00;

            let bat_name = bat_path.split('/').pop();
            let feature = {
                label: bat_name + " Voltage",
                ["volt"]: voltage
            };
            features.push(feature);
        })
        return features;
    }


    destroy(callback) {
        this._bat_path = [];
    }

    execute(callback) {
        this._updated = true;
        if (callback) callback();
    }

    _find_batteries() {
        const power_supply = Gio.File.new_for_path('/sys/class/power_supply');
        let enumerator;
        try {
            enumerator = power_supply.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null);
        } catch (e) {
            logError(e, '[FREON] failed to enumerate /sys/class/power_supply');
            return;
        }

        let info;
        while ((info = enumerator.next_file(null)) != null) {
            let name = info.get_name();
            if (name.startsWith('BAT'))
                this._bat_path.push('/sys/class/power_supply/' + name);
        }
        enumerator.close(null);
    }

    _get_sensor_data(bat_path, sensor) {
        const path = `${bat_path}/${sensor}`;
        try {
            let [ok, contents] = GLib.file_get_contents(path);
            if (ok)
                return new TextDecoder().decode(contents);
        } catch (e) {
            logError(e, `[FREON] failed to read ${path}`);
        }
        return "";
    }

}
