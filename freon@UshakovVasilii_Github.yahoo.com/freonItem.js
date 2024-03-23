import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export default class FreonItem extends PopupMenu.PopupBaseMenuItem {

    static {
        GObject.registerClass(this);
    }

    constructor(gIcon, key, label, value, displayName) {
        super();
        this._main = false;
        this._key = key;
        this._gIcon = gIcon;

        this._labelActor = new St.Label({text: displayName ? displayName : label, x_align: Clutter.ActorAlign.CENTER, x_expand: true});
        this.actor.add_child(new St.Icon({ style_class: 'popup-menu-icon', gicon : gIcon}));
        this.actor.add_child(this._labelActor);
        this._valueLabel = new St.Label({text: value});
        this.actor.add_child(this._valueLabel);
    }

    set main(main) {
        if(main)
            this.setOrnament(PopupMenu.Ornament.CHECK);
        else
            this.setOrnament(PopupMenu.Ornament.NONE);
        this._main = main;
    }

    get main() {
        return this._main;
    }

    get key() {
        return this._key;
    }

    set display_name(text) {
        return this._labelActor.text = text;
    }

    get gicon() {
        return this._gIcon;
    }

    set value(value) {
        this._valueLabel.text = value;
    }
}
