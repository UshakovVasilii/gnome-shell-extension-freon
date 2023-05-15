const Me = imports.misc.extensionUtils.getCurrentExtension();
const FileModule = Me.imports.helpers.file;
const CommandLineUtil = Me.imports.commandLineUtil;

class MemorySensor {
    constructor(label, type, value) {
        this._label = label;
        this._type = type;
        this._value = value;
    }

    get label() {
        return this._label;
    }

    get type() {
        return this._type;
    }

    get value() {
        return this._value;
    }
}

var MemoryUtil = class extends CommandLineUtil.CommandLineUtil {
    constructor() {
        super();
    }

    get available() {
        return true;
    }

    execute(callback) {
        new FileModule.File("/proc/meminfo").read().then(lines => {
            let values = [];
            let total = 0, available = 0, swapTotal = 0, swapFree = 0, cached = 0, memFree = 0;

            if (values = lines.match(/MemTotal:\s+(\d+)/)) total = values[1];
            if (values = lines.match(/MemAvailable:\s+(\d+)/)) available = values[1];
            if (values = lines.match(/SwapTotal:\s+(\d+)/)) swapTotal = values[1];
            if (values = lines.match(/SwapFree:\s+(\d+)/)) swapFree = values[1];
            if (values = lines.match(/Cached:\s+(\d+)/)) cached = values[1];
            if (values = lines.match(/MemFree:\s+(\d+)/)) memFree = values[1];

            let used = total - available;

            if (total > 0) {
                let usage = (used / total) * 100;
                this._usage = usage;
            }
            this._physical = total;
            this._available = available;
            this._allocated = used;
            this._cached = cached;
            this._free = memFree;
            this._swap = swapTotal - swapFree;

            callback();
        });
    }

    get usage() {
        return this._usage;
    }

    get physical() {
        return this._physical;
    }

    get allocated() {
        return this._allocated;
    }

    get cached() {
        return this._cached;
    }

    get free() {
        return this._free;
    }

    get swap() {
        return this._swap;
    }

    get sensors() {
        let sensors = [];
        if (this._usage) {
            sensors.push(new MemorySensor("Usage", "percent", this._usage));
        }
        if (this._physical) {
            sensors.push(new MemorySensor("Physical", "size", this._physical));
        }
        if (this._available) {
            sensors.push(new MemorySensor("Available", "size", this._available));
        }
        if (this._allocated) {
            sensors.push(new MemorySensor("Allocated", "size", this._allocated));
        }
        if (this._cached) {
            sensors.push(new MemorySensor("Cached", "size", this._cached));
        }
        if (this._free) {
            sensors.push(new MemorySensor("Free", "size", this._free));
        }
        if (this._swap) {
            sensors.push(new MemorySensor("Swap", "size", this._swap));
        }
        return sensors;
    }
};
