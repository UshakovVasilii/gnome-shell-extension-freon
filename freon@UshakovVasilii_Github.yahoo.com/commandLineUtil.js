import Gio from 'gi://Gio';

export default class CommandLineUtil {

    constructor() {
        this._argv = null;
        this._updated = false;
        this._cancellable = new Gio.Cancellable();
        this._destroyed = false;
    }

    execute(callback) {
        if (this._destroyed || !this._argv) {
            if (callback) callback();
            return;
        }
        try {
            this._callback = callback;

            let proc = Gio.Subprocess.new(this._argv,
                                          Gio.SubprocessFlags.STDOUT_PIPE |
                                          Gio.SubprocessFlags.STDERR_PIPE);

            proc.communicate_utf8_async(null, this._cancellable, (proc, result) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(result);

                    if (this._destroyed)
                        return;

                    this._output = stdout ? stdout.split('\n') : [];
                    this._error_output = stderr ? stderr.split('\n') : [];
                } catch (e) {
                    if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        logError(e);
                } finally {
                    this._updated = true;
                    if (!this._destroyed && callback)
                        callback();
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
        this._destroyed = true;
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        this._argv = null;
        this._output = null;
        this._error_output = null;
        this._callback = null;
    }

}
