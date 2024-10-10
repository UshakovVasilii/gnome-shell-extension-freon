import Gio from 'gi://Gio'
import Gtk from 'gi://Gtk'
import Adw from 'gi://Adw'

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class FreonPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        window.set_default_size(1010, 800);

        const grid = new Gtk.Grid({
            column_homogeneous: true,
            column_spacing: 10,
            row_homogeneous: false,
        });

        this._settings = this.getSettings()
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',

        });
        
        const display_options = this._create_display_options();
        const generic_sensor_providers = this._create_generic_sensor_providers();
        const gpu_sensor_providers = this._create_gpu_sensor_providers();
        const drive_sensor_providers = this._create_drive_sensor_providers();
        const show_sensors = this._create_show_sensors();
        const item_group = this._create_item_grouping();

        grid.attach(display_options,          0, 0, 1, 12);
        grid.attach(generic_sensor_providers, 1, 0, 1, 4);
        grid.attach(gpu_sensor_providers,     1, 4, 1, 4);
        grid.attach(drive_sensor_providers,   1, 8, 1, 4);
        grid.attach(show_sensors,             2, 0, 1, 6);
        grid.attach(item_group,               2, 6, 1, 4);

        const widget = new Adw.PreferencesGroup({
            hexpand: true,
            vexpand: true,
        })
        widget.add(grid);

        page.add(widget);

        window.add(page);
    }


    _create_display_options() {
        const group = new Adw.PreferencesGroup({
            title: _('Display Options'),
            width_request: 320,
        })
    
        const sensor_poll_intervall = new Adw.SpinRow({
            title: _('Sensor Polling Interval'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                value: 5,
                step_increment: 1,
            })
        })
        this._settings.bind('update-time', sensor_poll_intervall, 'value', Gio.SettingsBindFlags.DEFAULT)
        group.add(sensor_poll_intervall)

        const position_in_panel = new Adw.ComboRow({
            title: _('Panel Position'),
            model: new Gtk.StringList({strings: ["Left", "Center", "Right"] }),
        })
        this._settings.bind("position-in-panel", position_in_panel, "selected", Gio.SettingsBindFlags.NO_SENSETIVITY);
        group.add(position_in_panel)

        
        const index_on_panel = new Adw.SpinRow({
            title: _('Index on Panel'),
            adjustment: new Gtk.Adjustment({
                lower: -1,
                upper: 25,
                value: 1,
                step_increment: 1,
            })
        });
        group.add(index_on_panel);
        this._settings.bind('panel-box-index', index_on_panel, 'value', Gio.SettingsBindFlags.DEFAULT);

        group.add(this._addSwitch("Show Icon on Panel", "show-icon-on-panel"));
        
        const unit_setting = new Adw.ComboRow({
            title: _('Temperature Unit'),
            model: new Gtk.StringList({strings: ["\u00b0C", "\u00b0F"]}),
        });
        this._settings.bind("unit", unit_setting, "selected", Gio.SettingsBindFlags.NO_SENSETIVITY);
        group.add(unit_setting);

        group.add(this._addSwitch("Show Temperature Unit", "show-temperature-unit"));
        group.add(this._addSwitch("Show Rotation Rate Unit", "show-rotationrate-unit"));
        group.add(this._addSwitch("Show Voltage Unit", "show-voltage-unit"));
        group.add(this._addSwitch("Show Power Unit", "show-power-unit"));
        group.add(this._addSwitch("Show Decimal Values", "show-decimal-value", "Show additional digits after decimal point"));
        return group;
    }

    _create_generic_sensor_providers() {
        const group = new Adw.PreferencesGroup({
            title: _('Generic Sensor Providers'),
            width_request: 320,
        });

        group.add(this._addSwitch("lm-sensors", "use-generic-lmsensors", "Read sensors from lm-sensors"));
        group.add(this._addSwitch("liquidctl", "use-generic-liquidctl", "Read sensors from liquidctl (v1.7.0+)"));

        const freeimpi = new Adw.ComboRow({
            title: _('FreeIMPI'),
            model: new Gtk.StringList({strings: ["Disabled", "Direct", "pkexec"] }),
            selected: this._settings.get_int("freeimpi-selected"),
            subtitle: "Read sensors using ipmi-sensors from FreeIPMI"
        });
        this._settings.bind("freeimpi-selected", freeimpi, "selected", Gio.SettingsBindFlags.NO_SENSETIVITY);
        group.add(freeimpi);

        return group;
    }

    _create_gpu_sensor_providers() {
        const group = new Adw.PreferencesGroup({
            title: _('GPU Sensor Providers'),
            width_request: 320,
        });
        group.add(this._addSwitch("Nvidia", "use-gpu-nvidia"));
        group.add(this._addSwitch("Bumblebee + Nvidia", "use-gpu-bumblebeenvidia"));
        group.add(this._addSwitch("Catalyst", "use-gpu-aticonfig"));

        return group;
    }

    _create_drive_sensor_providers() {
        const group = new Adw.PreferencesGroup({
            title: _('Drive Sensor Providers'),
            width_request: 320,
        });
        group.add(this._addSwitch("Udisks2", "use-drive-udisks2"));
        group.add(this._addSwitch("Hddtemp", "use-drive-hddtemp"));
        group.add(this._addSwitch("smartctl", "use-drive-smartctl", "Read drive sensors using smartctl from smartmontools"));
        group.add(this._addSwitch("nvme-cli", "use-drive-nvmecli"));
    
        return group;
    }

    _create_show_sensors() {
        const group = new Adw.PreferencesGroup({
            title: _('Show Sensors'),
            width_request: 320,
        })
    
        group.add(this._addSwitch("Temperature", "show-temperature"));
        group.add(this._addSwitch("Rotation Rate", "show-rotationrate"));
        group.add(this._addSwitch("Voltage", "show-voltage"));
        group.add(this._addSwitch("Power", "show-power"));
        group.add(this._addSwitch("Battery", "show-battery-stats"));
        return group
    }

    _create_item_grouping() {
        const group = new Adw.PreferencesGroup({
            title: _('Group Items'),
            width_request: 320,
            description: "Group three or more sensor of the same type",
        })
        group.add(this._addSwitch("Temperature", "group-temperature"));
        group.add(this._addSwitch("Rotation Rate", "group-rotationrate"));
        group.add(this._addSwitch("Voltage", "group-voltage"));
        return group;
    }

    _addSwitch(title, key, help = "") {
        const sw = new Adw.SwitchRow({
            title: _(title),
            active: this._settings.get_boolean(key),
            subtitle: help
        });
        this._settings.bind(key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
        return sw;
    }
}
