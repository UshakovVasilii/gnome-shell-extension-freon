import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import SensorsUtil from './sensorsUtil.js';
import FreeipmiUtil from './freeipmiUtil.js';
import LiquidctlUtil from './liquidctlUtil.js';

import NvidiaUtil from './nvidiaUtil.js';
import BumblebeeNvidiaUtil from './bumblebeeNvidiaUtil.js';
import AticonfigUtil from './aticonfigUtil.js';

import Udisks2Util from './udisks2.js';
import HddtempUtil from './hddtempUtil.js';
import SmartctlUtil from './smartctlUtil.js';
import NvmecliUtil from './nvmecliUtil.js';

import FreonItem from './freonItem.js';

function _makeLogFunction(prefix) {
    return msg => {
        // Grab the second line of a stack trace, i.e. caller of debug()
        let regex = /(?:(?:[^<.]+<\.)?([^@]+))?@(.+):(\d+):\d+/g;
        let trace = ((msg.stack) ? msg : new Error()).stack.split('\n')[1];
        let [m, func, file, line] = regex.exec(trace);
        file = GLib.path_get_basename(file);

        let hdr = [file, func, line].filter(k => (k)).join(':');

        GLib.log_structured(
            'freon',
            GLib.LogLevelFlags.LEVEL_MESSAGE,
            {
                MESSAGE: `[${prefix}] [${hdr}]: ${msg}`,
                SYSLOG_IDENTIFIER: 'org.gnome.shell.extensions.freon',
                CODE_FILE: file,
                CODE_FUNC: `${func}`,
                CODE_LINE: `${line}`
            }
        );
    }
}

class FreonMenuButton extends PanelMenu.Button {

    static {
        GObject.registerClass(this);
    }

    constructor(uuid, path, settings) {
        super(0);

        this._extension_uuid = uuid;
        this._settings = settings;

        var _debugFunc = _makeLogFunction('DEBUG');
        this.debug = this._settings.get_boolean('debug') ? _debugFunc : () => {};

        this._settings.connect('changed::debug', () => {
            this.debug = this._settings.get_boolean('debug') ? _debugFunc : () => {};
        });

        this._sensorMenuItems = {};

        this._utils = {};

        this._initSensorsUtility();
        this._initFreeipmiUtility();
        this._initLiquidctlUtility();

        this._initNvidiaUtility();
        this._initBumblebeeNvidiaUtility();
        this._initAticonfigUtility();

        this._initUdisks2Utility();
        this._initHddtempUtility();
        this._initSmartctlUtility();
        this._initNvmecliUtility();

        let temperatureIcon = Gio.icon_new_for_string(path + '/icons/material-icons/material-temperature-symbolic.svg');
        let voltageIcon = Gio.icon_new_for_string(path + '/icons/freon-voltage-symbolic.svg');

        this._sensorIcons = {
            'temperature' : temperatureIcon,
            'temperature-average' : temperatureIcon,
            'temperature-maximum' : temperatureIcon,
            'gpu-temperature' : Gio.icon_new_for_string(path + '/icons/material-icons/material-gpu-temperature-symbolic.svg'),
            'drive-temperature' : Gio.icon_new_for_string('drive-harddisk-symbolic'),
            'voltage' : voltageIcon,
            'fan' : Gio.icon_new_for_string(path + '/icons/freon-fan-symbolic.svg'),
            'power' : voltageIcon,
        }

        this._menuLayout = new St.BoxLayout();

        this._hotLabels = {};
        this._hotIcons = {};

        let hotSensors = this._settings.get_strv('hot-sensors');
        let showIcon = this._settings.get_boolean('show-icon-on-panel');

        for (let s of hotSensors){
            this._createHotItem(s, showIcon);
        }

        if(hotSensors.length == 0){
            this._createInitialIcon();
        }

        this.add_child(this._menuLayout);

        this._settingChangedSignals = [];

        this._addSettingChangedSignal('hot-sensors', this._querySensors.bind(this));

        this._addSettingChangedSignal('update-time', this._updateTimeChanged.bind(this));
        this._addSettingChangedSignal('position-in-panel', this._positionInPanelChanged.bind(this));
        this._addSettingChangedSignal('panel-box-index', this._positionInPanelChanged.bind(this));
        this._addSettingChangedSignal('show-icon-on-panel', this._showIconOnPanelChanged.bind(this));

        this._addSettingChangedSignal('show-temperature-unit', this._updateUI.bind(this));
        this._addSettingChangedSignal('unit', this._querySensors.bind(this));
        this._addSettingChangedSignal('show-rotationrate-unit', this._updateUI.bind(this));
        this._addSettingChangedSignal('show-voltage-unit', this._updateUI.bind(this));
        this._addSettingChangedSignal('show-power-unit', this._updateUI.bind(this));

        this._addSettingChangedSignal('show-decimal-value', this._querySensors.bind(this));

        this._addSettingChangedSignal('use-generic-lmsensors', this._sensorsUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-generic-freeipmi', this._freeipmiUtilityChanged.bind(this));
        this._addSettingChangedSignal('exec-method-freeipmi', this._freeipmiUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-generic-liquidctl', this._liquidctlUtilityChanged.bind(this));

        this._addSettingChangedSignal('use-gpu-nvidia', this._nvidiaUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-gpu-nvidiabumblebee', this._nvidiabumblebeeUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-gpu-aticonfig', this._aticonfigUtilityChanged.bind(this));

        this._addSettingChangedSignal('use-drive-udisks2', this._udisks2UtilityChanged.bind(this));
        this._addSettingChangedSignal('use-drive-hddtemp', this._hddtempUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-drive-smartctl', this._smartctlUtilityChanged.bind(this));
        this._addSettingChangedSignal('use-drive-nvmecli', this._nvmecliUtilityChanged.bind(this));

        this._addSettingChangedSignal('show-temperature', this._rerender.bind(this));
        this._addSettingChangedSignal('show-rotationrate', this._rerender.bind(this));
        this._addSettingChangedSignal('show-voltage', this._rerender.bind(this));
        this._addSettingChangedSignal('show-power', this._rerender.bind(this));

        this._addSettingChangedSignal('group-temperature', this._rerender.bind(this))
        this._addSettingChangedSignal('group-rotationrate', this._rerender.bind(this))
        this._addSettingChangedSignal('group-voltage', this._rerender.bind(this))

        this.connect('destroy', this._onButtonDestroy.bind(this));

        // don't postprone the first call by update-time.
        this._querySensors();

        this._addTimer();
        this._updateUI(true);
        this._updateUITimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._updateUI();
            // readd to update queue
            return true;
        });
    }

    _createHotItem(s, showIcon, gicon){
        if(showIcon){
            let i = new St.Icon({ style_class: 'system-status-icon'});
            this._hotIcons[s] = i;

            if(gicon)
                i.gicon = gicon;

            this._menuLayout.add_child(i);
        }
        let l = new St.Label({
            text: '\u26a0',  // ⚠, warning
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER});
        l.set_style_class_name(showIcon ? 'freon-panel-icon-label' : 'freon-panel-no-icon-label');

        this._hotLabels[s] = l;
        this._menuLayout.add_child(l);
    }

    _createInitialIcon() {
        this._initialIcon = new St.Icon({ style_class: 'system-status-icon'});
        this._initialIcon.gicon = this._sensorIcons['gpu-temperature'];
        this._menuLayout.add_child(this._initialIcon);
    }

    _rerender(){
        this._needRerender = true;
        this._querySensors();
    }

    _positionInPanelChanged(){
        this.container.get_parent().remove_child(this.container);

        // small HACK with private boxes :)
        let boxes = {
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox
        };

        let p = this.positionInPanel;
        let i = this._settings.get_int('panel-box-index');
        boxes[p].insert_child_at_index(this.container, i);
    }

    _showIconOnPanelChanged(){
        let showIcon = this._settings.get_boolean('show-icon-on-panel');
        if (showIcon) {
            let index = 0;
            for(let k in this._hotLabels){
                let i = new St.Icon({ style_class: 'system-status-icon'});
                this._hotIcons[k] = i;
                i.gicon = this._sensorMenuItems[k].gicon;
                this._menuLayout.insert_child_at_index(i, index);
                index += 2;
            }
        } else {
            for(let k in this._hotIcons)
                this._hotIcons[k].destroy();
            this._hotIcons = {};
        }
        for (let l in this._hotLabels)
            this._hotLabels[l].set_style_class_name(showIcon ? 'freon-panel-icon-label' : 'freon-panel-no-icon-label');
    }

    _initSensorsUtility() {
        if (this._settings.get_boolean('use-generic-lmsensors'))
            this._utils.sensors = new SensorsUtil();
    }

    _destroySensorsUtility() {
        if (this._utils.sensors) {
            this._utils.sensors.destroy();
            delete this._utils.sensors;
        }
    }

    _sensorsUtilityChanged() {
        this._destroySensorsUtility();
        this._initSensorsUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initFreeipmiUtility() {
        if (this._settings.get_boolean('use-generic-freeipmi'))
        {
            let exec_method = this._settings.get_string('exec-method-freeipmi');
            try {
                this._utils.freeipmi = new FreeipmiUtil(exec_method);
            } catch (e) {
                if (exec_method != 'direct') {
                    this._settings.set_string('exec-method-freeipmi', 'direct');
                    this._freeipmiUtilityChanged();
                }
            }
        }
    }

    _destroyFreeipmiUtility() {
        if(this._utils.freeipmi) {
            this._utils.freeipmi.destroy();
            delete this._utils.freeipmi;
        }
    }

    _freeipmiUtilityChanged() {
        this._destroyFreeipmiUtility();
        this._initFreeipmiUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initLiquidctlUtility() {
        if (this._settings.get_boolean('use-generic-liquidctl'))
            this._utils.liquidctl = new LiquidctlUtil();
    }

    _destroyLiquidctlUtility() {
        if (this._utils.liquidctl) {
            this._utils.liquidctl.destroy();
            delete this._utils.liquidctl;
        }
    }

    _liquidctlUtilityChanged() {
        this._destroyLiquidctlUtility();
        this._initLiquidctlUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initNvidiaUtility() {
        if (this._settings.get_boolean('use-gpu-nvidia'))
            this._utils.nvidia = new NvidiaUtil();
    }

    _destroyNvidiaUtility() {
        if (this._utils.nvidia) {
            this._utils.nvidia.destroy();
            delete this._utils.nvidia;
        }
    }

    _nvidiaUtilityChanged() {
        this._destroyNvidiaUtility();
        this._initNvidiaUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initBumblebeeNvidiaUtility() {
        if (this._settings.get_boolean('use-gpu-bumblebeenvidia'))
            this._utils.nvidiabumblebee = new BumblebeeNvidiaUtil();
    }

    _destroyBumblebeeNvidiaUtility() {
        if (this._utils.nvidiabumblebee) {
            this._utils.nvidiabumblebee.destroy();
            delete this._utils.nvidiabumblebee;
        }
    }

    _nvidiabumblebeeUtilityChanged() {
        this._destroyBumblebeeNvidiaUtility();
        this._initBumblebeeNvidiaUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initAticonfigUtility() {
        if (this._settings.get_boolean('use-gpu-aticonfig'))
            this._utils.aticonfig = new AticonfigUtil();
    }

    _destroyAticonfigUtility() {
        if (this._utils.aticonfig) {
            this._utils.aticonfig.destroy();
            delete this._utils.aticonfig;
        }
    }

    _aticonfigUtilityChanged() {
        this._destroyAticonfigUtility();
        this._initAticonfigUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initUdisks2Utility() {
        if (this._settings.get_boolean('use-drive-udisks2'))
            this._utils.udisks2 = new Udisks2Util(() => {
                 // this._updateDisplay(); we cannot change actor in background thread #74
            });
    }

    _destroyUdisks2Utility() {
        if (this._utils.udisks2) {
            this._utils.udisks2.destroy();
            delete this._utils.udisks2;
        }
    }

    _udisks2UtilityChanged() {
        this._destroyUdisks2Utility();
        this._initUdisks2Utility();
        this._querySensors();
        this._updateUI(true);
    }

    _initHddtempUtility() {
        if (this._settings.get_boolean('use-drive-hddtemp'))
            this._utils.hddtemp = new HddtempUtil();
    }

    _destroyHddtempUtility() {
        if (this._utils.hddtemp) {
            this._utils.hddtemp.destroy();
            delete this._utils.hddtemp;
        }
    }

    _hddtempUtilityChanged() {
        this._destroyHddtempUtility();
        this._initHddtempUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initSmartctlUtility() {
        if (this._settings.get_boolean('use-drive-smartctl'))
            this._utils.smartctl = new SmartctlUtil();
    }

    _destroySmartctlUtility() {
        if (this._utils.smartctl) {
            this._utils.smartctl.destroy();
            delete this._utils.smartctl;
        }
    }

    _smartctlUtilityChanged() {
        this._destroySmartctlUtility();
        this._initSmartctlUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _initNvmecliUtility() {
        if (this._settings.get_boolean('use-drive-nvmecli'))
            this._utils.nvmecli = new NvmecliUtil();
    }

    _destroyNvmecliUtility() {
        if (this._utils.nvmecli) {
            this._utils.nvmecli.destroy();
            delete this._utils.nvmecli;
        }
    }

    _nvmecliUtilityChanged() {
        this._destroyNvmecliUtility();
        this._initNvmecliUtility();
        this._querySensors();
        this._updateUI(true);
    }

    _updateTimeChanged(){
        GLib.Source.remove(this._timeoutId);
        this._addTimer();
    }

    _addTimer(){
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int('update-time'), () => {
            this._querySensors();
            // readd to update queue
            return true;
        });
    }

    _addSettingChangedSignal(key, callback){
        this._settingChangedSignals.push(this._settings.connect('changed::' + key, callback));
    }

    _onButtonDestroy(){
        this._destroySensorsUtility();
        this._destroyFreeipmiUtility();
        this._destroyLiquidctlUtility();

        this._destroyNvidiaUtility();
        this._destroyBumblebeeNvidiaUtility();
        this._destroyAticonfigUtility();

        this._destroyUdisks2Utility();
        this._destroyHddtempUtility();
        this._destroySmartctlUtility();
        this._destroyNvmecliUtility();

        GLib.Source.remove(this._timeoutId);
        GLib.Source.remove(this._updateUITimeoutId);

        for (let signal of this._settingChangedSignals){
            this._settings.disconnect(signal);
        };
    }

    _querySensors(){
        for (let sensor of Object.values(this._utils)) {
            if (sensor.available) {
                sensor.execute(() => {
                    // we cannot change actor in background thread #74
                });
            }
        }
    }

    _updateUI(needUpdate = false){
        for (let sensor of Object.values(this._utils)) {
            if (sensor.available && sensor.updated) {
                this.debug(sensor + ' updated');
                sensor.updated = false;
                needUpdate = true;
            }
        }

        if(needUpdate) {
            this._updateDisplay(); // #74
            this.debug('update display');
        }
    }

    _fixNames(sensors){
        let names = [];

        for (let s of sensors){
            if(s.type == 'separator' ||
               s.type == 'temperature-group' ||
               s.type == 'temperature-average' ||
               s.type == 'temperature-maximum')
                continue;

            let name = s.label;
            let i = 1;

            while(names.indexOf(name) >= 0){
                name = s.label + '-' + i++;
            }

            if(name != s.label){
                s.displayName = s.label;
                s.label = name;
            }

            names.push(name);
        }
    }

    _updateDisplay(){
        let sensorsTempInfo = [];
        let gpuTempInfo = []
        let driveTempInfo = [];
        let fanInfo = [];
        let voltageInfo = [];
        let powerInfo = [];

        if (this._utils.sensors && this._utils.sensors.available) {
            if (this._settings.get_boolean('show-temperature')) {
                sensorsTempInfo = sensorsTempInfo.concat(this._utils.sensors.temp);
                gpuTempInfo = gpuTempInfo.concat(this._utils.sensors.gpu);
                driveTempInfo = driveTempInfo.concat(this._utils.sensors.disks);
            }

            if (this._settings.get_boolean('show-rotationrate'))
                fanInfo = fanInfo.concat(this._utils.sensors.rpm);
            if (this._settings.get_boolean('show-voltage'))
                voltageInfo = voltageInfo.concat(this._utils.sensors.volt);
            if (this._settings.get_boolean('show-power'))
                powerInfo = powerInfo.concat(this._utils.sensors.power);
        }

        if (this._utils.freeipmi && this._utils.freeipmi.available) {
            if (this._settings.get_boolean('show-temperature'))
                sensorsTempInfo = sensorsTempInfo.concat(this._utils.freeipmi.temp);
            if (this._settings.get_boolean('show-rotationrate'))
                fanInfo = fanInfo.concat(this._utils.freeipmi.rpm);
            if (this._settings.get_boolean('show-voltage'))
                voltageInfo = voltageInfo.concat(this._utils.freeipmi.volt);
        }

        if (this._utils.liquidctl && this._utils.liquidctl.available) {
            if (this._settings.get_boolean('show-temperature'))
                sensorsTempInfo = sensorsTempInfo.concat(this._utils.liquidctl.temp);
            if (this._settings.get_boolean('show-rotationrate'))
                fanInfo = fanInfo.concat(this._utils.liquidctl.rpm);
            if (this._settings.get_boolean('show-voltage'))
                voltageInfo = voltageInfo.concat(this._utils.liquidctl.volt);
        }

        if (this._utils.nvidia && this._utils.nvidia.available)
            if (this._settings.get_boolean('show-temperature'))
                gpuTempInfo = gpuTempInfo.concat(this._utils.nvidia.temp);

        if (this._utils.nvidiabumblebee && this._utils.nvidiabumblebee.available)
            if (this._settings.get_boolean('show-temperature'))
                gpuTempInfo = gpuTempInfo.concat(this._utils.nvidiabumblebee.temp);

        if (this._utils.aticonfig && this._utils.aticonfig.available)
            if (this._settings.get_boolean('show-temperature'))
                gpuTempInfo = gpuTempInfo.concat(this._utils.aticonfig.temp);

        if (this._utils.udisks2 && this._utils.udisks2.available)
            if (this._settings.get_boolean('show-temperature'))
                driveTempInfo = driveTempInfo.concat(this._utils.udisks2.temp);

        if (this._utils.hddtemp && this._utils.hddtemp.available)
            if (this._settings.get_boolean('show-temperature'))
                driveTempInfo = driveTempInfo.concat(this._utils.hddtemp.temp);

        if (this._utils.smartctl && this._utils.smartctl.available)
            if (this._settings.get_boolean('show-temperature'))
                driveTempInfo = driveTempInfo.concat(this._utils.smartctl.temp);

        if (this._utils.nvmecli && this._utils.nvmecli.available)
            if (this._settings.get_boolean('show-temperature'))
                driveTempInfo = driveTempInfo.concat(this._utils.nvmecli.temp);

        const comparator = (a, b) => a.label.localeCompare(b.label, undefined, {numeric: true})
        sensorsTempInfo.sort(comparator);
        driveTempInfo.sort(comparator);
        fanInfo.sort(comparator);
        voltageInfo.sort(comparator);
        powerInfo.sort(comparator);

        let tempInfo = gpuTempInfo.concat(sensorsTempInfo).concat(driveTempInfo);

        if (tempInfo.length == 0
            && fanInfo.length == 0
            && voltageInfo.length == 0) {
            this._sensorMenuItems = {};
            this.menu.removeAll();

            let item = new PopupMenu.PopupMenuItem(
                this._utils.sensors && this._utils.sensors.available
                    ? _("Please run sensors-detect as root.")
                    : _("Please install lm_sensors.\nIf this doesn\'t help, click here to report with your sensors output!")
            );

            item.connect('activate',function() {
                Util.spawn(["xdg-open", "https://github.com/UshakovVasilii/gnome-shell-extension-freon/wiki/Dependency"]);
            });

            this.menu.addMenuItem(item);
            this._appendStaticMenuItems();

            for (let k in this._hotLabels)
                this._hotLabels[k].set_text('\u26a0');  // ⚠, warning
        } else {
            let tempMean = 0;
            let tempMax = 0;

            for (let i of tempInfo) {
                let sum = 0;
                let total = 0;

                if (i.temp !== null && i.temp >= 0) {
                    total++;
                    sum += i.temp;

                    if (i.temp > tempMax)
                        tempMax = i.temp;
                }

                if (total != 0)
                    tempMean = sum / total;
            }

            let sensors = [];

            for (let i of gpuTempInfo) {
                sensors.push({
                    icon: 'gpu-temperature',
                    type: 'temperature',
                    label: i.label,
                    value: this._formatTemp(i.temp),
                    displayName: i.displayName});
            }

            for (let i of sensorsTempInfo) {
                sensors.push({
                    icon: 'temperature',
                    type: 'temperature',
                    label: i.label,
                    value: this._formatTemp(i.temp)});
            }

            for (let i of driveTempInfo) {
                sensors.push({
                    icon: 'drive-temperature',
                    type: 'temperature',
                    label: i.label,
                    value: this._formatTemp(i.temp)});
            }

            if (tempInfo.length > 0) {
                sensors.push({type : 'separator'});

                // Add average and maximum entries
                sensors.push({
                    icon: 'temperature-average',
                    type: 'temperature-average',
                    key: '__average__',
                    label: _("Average"),
                    value: this._formatTemp(tempMean)});

                sensors.push({
                    icon: 'temperature-maximum',
                    type: 'temperature-maximum',
                    key: '__max__',
                    label: _("Maximum"),
                    value: this._formatTemp(tempMax)});

                if (fanInfo.length > 0 || voltageInfo.length > 0)
                    sensors.push({type : 'separator'});
            }

            if (tempInfo.length > 0 && this._settings.get_boolean('group-temperature')) {
                sensors.push({
                    icon: 'temperature-group',
                    type: 'temperature-group',
                    label: 'temperature-group',
                    value: this._formatTemp(tempMean)});
            }

            for (let fan of fanInfo){
                const unit = this._settings.get_boolean('show-rotationrate-unit') ? _(' rpm'): '';

                sensors.push({
                    icon: 'fan',
                    type: 'fan',
                    label: fan.label,
                    value: _("%d%s").format(fan.rpm, unit)});
            }

            if (fanInfo.length > 0 && voltageInfo.length > 0){
                sensors.push({type : 'separator'});
            }

            for (let voltage of voltageInfo){
                const unit = this._settings.get_boolean('show-voltage-unit') ? _('V'): '';

                sensors.push({
                    icon: 'voltage',
                    type: 'voltage',
                    label: voltage.label,
                    value: _("%s%.2f%s").format(((voltage.volt >= 0) ? '+' : ''),
                    voltage.volt, unit)});
            }

            for (let power of powerInfo){
                const unit = this._settings.get_boolean('show-power-unit') ? _('W'): '';

                sensors.push({
                    icon: 'power',
                    type: 'power',
                    label: power.label,
                    value: _("%s%.2f%s").format(((power.power >= 0) ? '+' : ''),
                    power.power, unit)});
            }

            this._fixNames(sensors);

            for (let k in this._hotLabels)
                this._hotLabels[k].set_text('\u26a0');  // ⚠, warning

            for (let s of sensors)
                if(s.type != 'separator') {
                    let l = this._hotLabels[s.key || s.label];
                    if(l)
                        l.set_text(s.value);
                }

            if(this._lastSensorsCount && this._lastSensorsCount==sensors.length){
                for (let s of sensors) {
                    if(s.type != 'separator') {
                        let item = this._sensorMenuItems[s.key || s.label];
                        if(item) {
                            if(s.type == 'temperature-group')
                                item.status.text = s.value;
                            else {
                                item.value = s.value;
                                if(s.displayName)
                                    item.display_name = s.displayName;
                            }
                        } else {
                            this._needRerender = true;
                        }
                    }
                }
            } else {
                this._needRerender = true;
            }

            if(this._needRerender){
                this._needRerender = false;
                this.debug('Render all MenuItems');
                this.menu.removeAll();
                this._appendMenuItems(sensors);
            }
        }
    }

    _appendStaticMenuItems(){
        // separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let wiki = new PopupMenu.PopupBaseMenuItem();
        wiki.actor.add_child(new St.Label({ text: _("Go to the Freon wiki"), x_align: Clutter.ActorAlign.START, x_expand: true }));
        wiki.connect('activate', () => {
            Util.spawn(["xdg-open", "https://github.com/UshakovVasilii/gnome-shell-extension-freon/wiki"]);
        });

        this.menu.addMenuItem(wiki);

        let settings = new PopupMenu.PopupBaseMenuItem();
        settings.actor.add_child(new St.Label({ text: _("Sensor Settings"), x_align: Clutter.ActorAlign.START, x_expand: true }));
        settings.connect('activate', () => {
            Util.spawn(["gnome-extensions", "prefs", this._extension_uuid]);
        });

        this.menu.addMenuItem(settings);
    }

    _appendMenuItems(sensors){
        this._lastSensorsCount = sensors.length;
        this._sensorMenuItems = {};
        let needGroupTemperature = this._settings.get_boolean('group-temperature');
        let needGroupRotationRate = this._settings.get_boolean('group-rotationrate');
        let needGroupVoltage = this._settings.get_boolean('group-voltage');

        if (needGroupRotationRate) {
            let i = 0;

            for (let s of sensors)
                if (s.type == 'fan')
                    i++;

            if (i < 2)
                needGroupRotationRate = false;
        }

        if (needGroupVoltage) {
            let i = 0;

            for (let s of sensors)
                if (s.type == 'voltage')
                    i++;

            if (i < 2)
                needGroupVoltage = false;
        }

        let temperatureGroup = null;
        let rotationrateGroup = null;
        let voltageGroup = null;

        for (let s of sensors){
            if(s.type == 'separator') {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if (s.type == 'temperature-group') {
                if(temperatureGroup) {
                    temperatureGroup.status.text = s.value;
                    this._sensorMenuItems['temperature-group'] = temperatureGroup;
                }
            } else {
                let key = s.key || s.label;
                let item = new FreonItem(this._sensorIcons[s.icon], key, s.label, s.value, s.displayName || undefined);

                item.connect('activate', (self) => {
                    let l = this._hotLabels[self.key];
                    let hotSensors = this._settings.get_strv('hot-sensors');

                    if (l) {
                        hotSensors.splice(hotSensors.indexOf(self.key), 1);
                        delete this._hotLabels[self.key];
                        l.destroy(); // destroy is called after dict cleanup to prevert set_label on not exist actor
                        let i = this._hotIcons[self.key];

                        if (i) {
                            i.destroy();
                            delete this._hotIcons[self.key];
                        }

                        self.main = false;
                    } else {
                        hotSensors.push(self.key);

                        if (Object.keys(this._hotLabels).length == 0) {
                            this._initialIcon.destroy();
                            this._initialIcon = null;
                        }

                        let showIcon = this._settings.get_boolean('show-icon-on-panel');
                        this._createHotItem(self.key, showIcon, self.gicon);
                        self.main = true;
                    }

                    for (let i = hotSensors.length -1; i >= 0 ; i--) {
                        let k = hotSensors[i];

                        if (!this._sensorMenuItems[k]) {
                            hotSensors.splice(i, 1);
                            let ll = this._hotLabels[k]
                            delete this._hotLabels[k];
                            ll.destroy(); // destroy is called after dict cleanup to prevert set_label on not exist actor

                            if (this._hotIcons[k]) {
                                this._hotIcons[k].destroy();
                                delete this._hotIcons[k];
                            }
                        }
                    }

                    if (Object.keys(this._hotLabels).length == 0)
                        this._createInitialIcon();

                    this._settings.set_strv('hot-sensors', hotSensors.filter(
                        function(item, pos) {
                            return hotSensors.indexOf(item) == pos;
                        }));
                });

                if (this._hotLabels[key]) {
                    item.main = true;
                    if(this._hotIcons[key])
                        this._hotIcons[key].gicon = item.gicon;
                }

                this._sensorMenuItems[key] = item;

                if (needGroupTemperature && s.type == 'temperature') {
                    if (!temperatureGroup) {
                        temperatureGroup = new PopupMenu.PopupSubMenuMenuItem(_('Temperature'), true);
                        temperatureGroup.icon.gicon = this._sensorIcons['temperature'];

                        if (!temperatureGroup.status) { // gnome 3.18 and hight
                            temperatureGroup.status = new St.Label({
                                     style_class: 'popup-status-menu-item',
                                     y_expand: true,
                                     y_align: Clutter.ActorAlign.CENTER });
                            temperatureGroup.actor.insert_child_at_index(temperatureGroup.status, 4);
                        }

                        this.menu.addMenuItem(temperatureGroup);
                    }

                    temperatureGroup.menu.addMenuItem(item);
                } else if (needGroupRotationRate && s.type == 'fan') {
                    if (!rotationrateGroup) {
                        rotationrateGroup = new PopupMenu.PopupSubMenuMenuItem(_('Rotation Rate'), true);
                        rotationrateGroup.icon.gicon = this._sensorIcons['fan'];
                        this.menu.addMenuItem(rotationrateGroup);
                    }

                    rotationrateGroup.menu.addMenuItem(item);
                } else if (needGroupVoltage && s.type == 'voltage') {
                    if (!voltageGroup) {
                        voltageGroup = new PopupMenu.PopupSubMenuMenuItem(_('Voltage'), true);
                        voltageGroup.icon.gicon = this._sensorIcons['voltage'];
                        this.menu.addMenuItem(voltageGroup);
                    }

                    voltageGroup.menu.addMenuItem(item);
                } else {
                    this.menu.addMenuItem(item);
                }
            }
        }
        this._appendStaticMenuItems();
    }


    _toFahrenheit(c){
        return ((9/5)*c+32);
    }

    _formatTemp(value) {
        if(value === null)
            return 'N/A';
        if (this._settings.get_string('unit')=='fahrenheit'){
            value = this._toFahrenheit(value);
        }
        let format = '%.1f';
        if (!this._settings.get_boolean('show-decimal-value')){
            format = '%.0f';
        }
        format += '%s';

        if(this._settings.get_boolean('show-temperature-unit')){
            return format.format(value, (this._settings.get_string('unit')=='fahrenheit') ? "\u00b0F" : "\u00b0C" );
        } else {
            return format.format(value, "");
        }
    }

    get positionInPanel(){
        return this._settings.get_string('position-in-panel');
    }
}

export default class extends Extension {

    enable() {
        this._freonMenu = new FreonMenuButton(this.uuid, this.path, this.getSettings());
        Main.panel.addToStatusArea('freonMenu', this._freonMenu);
        this._freonMenu._positionInPanelChanged();
    }

    disable() {
        this._freonMenu?.destroy();
        this._freonMenu = null;
    }
}
