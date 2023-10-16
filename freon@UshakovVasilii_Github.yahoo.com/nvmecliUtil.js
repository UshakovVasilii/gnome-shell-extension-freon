import GLib from 'gi://GLib';

function getNvmeData (argv){
    const nvme = GLib.find_program_in_path('nvme')
    return JSON.parse(new TextDecoder().decode(GLib.spawn_command_line_sync(`${nvme} ${argv} -o json`)[1]))
}

export default class NvmecliUtil {

    constructor(callback) {
        this._nvmeDevices = [];
        try {
            this._nvmeDevices = getNvmeData("list")["Devices"]
        } catch (e) {
            logError(e, '[FREON] Unable to find nvme devices');
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
