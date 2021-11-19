const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();

function getNvmeData (argv){
    const nvme = GLib.find_program_in_path('nvme')
    return JSON.parse(GLib.spawn_command_line_sync(`${nvme} ${argv} -o json`)[1].toString())
}

var NvmecliUtil  = class {
    constructor(callback) {
        this._nvmeDevices = [];
        try {
            this._nvmeDevices = getNvmeData("list")["Devices"]
        } catch (e) {
            global.log('[FREON] Unable to find nvme devices: ' + e);
        }
        this._updated = true;
    }

    get available(){
        return this._nvmeDevices.length > 0;
    }

    get updated (){
       return this._updated;
    }

    set updated (updated){
        this._updated = updated;
    }

    get temp() {
        let sensors = [];
        for (let device of this._nvmeDevices) {
            var smart_log = getNvmeData(`smart-log ${device["DevicePath"]}`);
            if( smart_log.hasOwnProperty('temperature_sensor_2') ){
                sensors.push({ label: device["ModelNumber"] + " S1",
                               temp: parseFloat(smart_log.temperature_sensor_1) - 273.15 });
                sensors.push({ label: device["ModelNumber"] + " S2",
                               temp: parseFloat(smart_log.temperature_sensor_2) - 273.15 });
                }
            else{
                 sensors.push({ label: device["ModelNumber"],
                                temp: parseFloat(smart_log.temperature) - 273.15 });
            }
       }
       return sensors;
   }

    destroy(callback) {
        this._nvmeDevices = [];
    }

    execute(callback) {
        this._updated = true;
    }

};
