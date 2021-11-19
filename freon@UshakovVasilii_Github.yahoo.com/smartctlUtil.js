const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;
function getSmartData (argv){
    const smartctl = GLib.find_program_in_path('smartctl')
    return JSON.parse(ByteArray.toString( GLib.spawn_command_line_sync(`'${smartctl}' ${argv} -j`)[1] ))
}

var SmartctlUtil  = class {
    constructor(callback) {
        this._smartDevices = [];
        try {
            this._smartDevices = getSmartData("--scan")["devices"]
        } catch (e) {
            global.log('[FREON] Unable to find smart devices: ' + e);
        }
        this._updated = true;
    }

    get available(){
        return this._smartDevices.length > 0;
    }

    get updated (){
       return this._updated;
    }

    set updated (updated){
        this._updated = updated;
    }

    get temp() {
        return this._smartDevices.map(device => {
            const info = getSmartData(`--info ${device["name"]}`);
            if (info["smartctl"]["exit_status"] != 0)
                return null;

            const attributes = getSmartData(`--attributes ${device["name"]}`);
            if (attributes["smartctl"]["exit_status"] != 0)
                return null;

            return {
                label: info["model_name"],
                temp: parseFloat(attributes.temperature.current)
            }
        }).filter(entry => entry != null);
    }

    destroy(callback) {
        this._smartDevices = [];
    }

    execute(callback) {
        this._updated = true;
    }

};
