import Gio from 'gi://Gio';

export default class CommandLineUtil {

    constructor(){
        this._argv = null;
        this._updated = false;
    }

    execute(callback) {
        try{
            this._callback = callback;

            let proc = Gio.Subprocess.new(this._argv,
                                          Gio.SubprocessFlags.STDOUT_PIPE |
                                          Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, null, (proc, result) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(result);

                    this._output = stdout ? stdout.split('\n') : [];
                    this._error_output = stderr ? stderr.split('\n') : [];
                } catch (e) {
                    logError(e);
                } finally {
                    callback();
                    this._updated = true;
                }
            });
        } catch(e){
            logError(e);
        }
    }

    get available(){
        return this._argv != null;
    }

    get updated (){
       return this._updated;
    }

    set updated (updated){
        this._updated = updated;
    }

    destroy(){
        this._argv = null;
    }

};
