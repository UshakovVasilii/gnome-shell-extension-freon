import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const modelColumn = {
    label: 0,
    separator: 1
}

var FreonPrefsWidget = new GObject.registerClass(class Freon_FreonPrefsWidget extends Gtk.Grid {

    constructor(settings) {
        super();
        this.margin = this.row_spacing = this.column_spacing = 20;

        this._settings = settings;

        let i = 0;
        let j = 0;

        this._addLabel({
            label: _('Display Options'),
            y : i++, x : j
        });

        this._addLabel({
            label: _('Poll Sensors Every (sec)'),
            y : i, x : j
        });

        let updateTime = Gtk.SpinButton.new_with_range (1, 60, 1);
        this.attach(updateTime, j + 1, i++, 1, 1);
        this._settings.bind('update-time', updateTime, 'value', Gio.SettingsBindFlags.DEFAULT);

        this._addComboBox({
            label: _('Position on Panel'),
            items : {left : _('Left'), center : _('Center'), right : _('Right')},
            key: 'position-in-panel', y : i++, x : j
        });

        this._addLabel({
            label: _('Index on Panel'),
            y : i, x : j
        });

        let panelBoxIndex = Gtk.SpinButton.new_with_range (-1, 20, 1);
        this.attach(panelBoxIndex, j + 1, i++, 1, 1);
        this._settings.bind('panel-box-index', panelBoxIndex, 'value', Gio.SettingsBindFlags.DEFAULT);

        this._addSwitch({key : 'show-icon-on-panel', y : i++, x : j,
            label : _('Show Icon on Panel')});

        this._addComboBox({
            label: _('Temperature Unit'),
            items : {centigrade : _("\u00b0C"), fahrenheit : _("\u00b0F")},
            key: 'unit', y : i++, x : j
        });

        this._addSwitch({key : 'show-temperature-unit', y : i++, x : j,
            label : _('Show Temperature Unit')});

        this._addSwitch({key : 'show-rotationrate-unit', y : i++, x : j,
            label : _('Show Rotation Rate Unit')});

        this._addSwitch({key : 'show-voltage-unit', y : i++, x : j,
            label : _('Show Voltage Unit')});

        this._addSwitch({key : 'show-power-unit', y : i++, x : j,
            label : _('Show Power Unit')});

        this._addSwitch({key : 'show-decimal-value', y : i++, x : j,
            label : _('Show Decimal Values'),
            help : _("Show additionnal digits after decimal point")});

        i = 0;
        j = 2;

        this._addLabel({
            label: _('Generic Sensor Providers'),
            y : i++, x : j
        });

        this._addSwitch({key : 'use-generic-lmsensors', y : i++, x : j,
            label : 'lm-sensors',
            help : _('Read sensors from lm-sensors')});

        this._addSwitch({key : 'use-generic-freeipmi', y : i, x : j,
            label : 'FreeIPMI',
            help : _('Read sensors using ipmi-sensors from FreeIPMI')});

        this._addComboBox({
            items : {
                'direct' : _('Direct'),
                'sudo' : 'sudo' },
            key: 'exec-method-freeipmi', y : i++, x : j + 1,
            label: ''
        });

        this._addSwitch({key : 'use-generic-liquidctl', y : i++, x : j,
            label : 'liquidctl',
            help : _('Read sensors from liquidctl (requires v1.7.0 or later)')});

        this._addLabel({
            label: _('GPU Sensor Providers'),
            y : i++, x : j
        });

        this._addSwitch({key : 'use-gpu-nvidia', y : i++, x : j,
            label : 'Nvidia'});

        this._addSwitch({key : 'use-gpu-bumblebeenvidia', y : i++, x : j,
            label : 'Bumblebee + Nvidia'});

        this._addSwitch({key : 'use-gpu-aticonfig', y : i++, x : j,
            label : 'Catalyst'});

        this._addLabel({
            label: _('Drive Sensor Providers'),
            y : i++, x : j
        });

        this._addSwitch({key : 'use-drive-udisks2', y : i++, x : j,
            label : 'Udisks2'});

        this._addSwitch({key : 'use-drive-hddtemp', y : i++, x : j,
            label : 'Hddtemp'});

        this._addSwitch({key : 'use-drive-smartctl', y : i++, x : j,
            label : 'smartctl',
            help : _('Read drive sensors using smartctl from smartmontools')});

        this._addSwitch({key : 'use-drive-nvmecli', y : i++, x : j,
            label : 'nvme-cli'});

        i = 0;
        j = 5;

        this._addLabel({
            label: _('Show Sensors'),
            y : i++, x : j
        });

        this._addSwitch({key : 'show-temperature', y : i++, x : j,
            label : _('Temperature')});

        this._addSwitch({key : 'show-rotationrate', y : i++, x : j,
            label : _('Rotation Rate')});

        this._addSwitch({key : 'show-voltage', y : i++, x : j,
            label : _('Voltage')});

        this._addSwitch({key : 'show-power', y : i++, x : j,
            label : _('Power')});

        this._addLabel({
            label: _('Group Items'),
            y : i++, x : j
        });

        this._addSwitch({key : 'group-temperature', y : i++, x : j,
            label : _('Temperature'),
            help : _("Group three or more temperature sensors")});

        this._addSwitch({key : 'group-rotationrate', y : i++, x : j,
            label : _('Rotation Rate'),
            help : _("Group three or more rotation rate sensors")});

        this._addSwitch({key : 'group-voltage', y : i++, x : j,
            label : _('Voltage'),
            help : _("Group three or more voltage sensors")});
       }

    _addLabel(params){
        let lbl = new Gtk.Label({label: params.label,halign : Gtk.Align.END});
        this.attach(lbl, params.x, params.y, 1, 1);

        if(params.help){
            lbl.set_tooltip_text(params.help);
        }
    }

    _addSwitch(params){
        this._addLabel(params);

        let sw = new Gtk.Switch({halign : Gtk.Align.END, valign : Gtk.Align.CENTER});
        this.attach(sw, params.x + 1, params.y, 1, 1);

        if(params.help){
            sw.set_tooltip_text(params.help);
        }

        this._settings.bind(params.key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _addComboBox(params){
        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

        let combobox = new Gtk.ComboBox({model: model});
        let renderer = new Gtk.CellRendererText();
        combobox.pack_start(renderer, true);
        combobox.add_attribute(renderer, 'text', 1);

        for(let k in params.items){
            model.set(model.append(), [0, 1], [k, params.items[k]]);
        }

        combobox.set_active(Object.keys(params.items).indexOf(this._settings.get_string(params.key)));

        combobox.connect('changed', (entry) => {
            let [success, iter] = combobox.get_active_iter();
            if (!success)
                return;
            this._settings.set_string(params.key, model.get_value(iter, 0))
        });

        this._addLabel(params);

        this.attach(combobox, params.x + 1, params.y, 1, 1);
    }
});

export default class extends ExtensionPreferences {

    getPreferencesWidget() {
        return new FreonPrefsWidget(this.getSettings());
    }
}
