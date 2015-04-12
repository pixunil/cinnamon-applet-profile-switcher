const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

//bind function with exception catching
function bind(func, context){
    function callback(){
        try {
            return func.apply(context, arguments);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

//recursively unpacks variants
function unpack(value){
    if(value instanceof GLib.Variant)
        value = value.unpack();
    if(value instanceof Object){
        for(let i in value)
            value[i] = unpack(value[i]);
    }
    return value;
}

function ProfileMenuItem(){
    this._init.apply(this, arguments);
}

ProfileMenuItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    _init: function(applet, profile){
        PopupMenu.PopupMenuItem.prototype._init.call(this, profile);
        this.applet = applet;
        this.profile = applet.settings.profiles[profile];
        this.profileName = profile;
        this.settings = applet.settings;
        this.gsettings = applet.gsettings;
    },

    activate: function(){
        this.settings.activeProfile = this.profileName;
        for(let key in this.profile){
            let type = this.getVariantType(key);
            this.gsettings.set_value(key, new GLib.Variant(type, this.profile[key]));
        }
        this.applet.updateProfilesSection();
    },

    getVariantType: function(key){
        let range = this.gsettings.get_range(key);
        let type = range.get_child_value(0).unpack();
        let v = range.get_child_value(1);

        if(type === "type"){
            //v is boxed empty array, type of its elements is the allowed value type
            return v.get_child_value(0).get_type_string().slice(1);
        } else if(type === "enum"){
            //v is an array with the allowed values
            return v.get_child_value(0).get_child_value(0).get_type_string();
        } else if(type === "flags"){
            //v is an array with the allowed values
            return v.get_child_value(0).get_type_string();
        } else if(type === "range"){
            //type_str is a tuple giving the range
            return v.get_child_value(0).get_type_string()[1];
        }
    }
}

function IconMenuItem(){
    this._init.apply(this, arguments);
}

IconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, params){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.icon = new St.Icon({style_class: "popup-menu-icon", icon_name: icon, icon_type: St.IconType.SYMBOLIC});
        this.label = new St.Label({text: text});

        this.addActor(this.icon);
        this.addActor(this.label);
    },

    setColumnWidths: function() {
        this._columnWidths = null;
    },

    getColumnWidths: function() {
        return [];
    }
}

function EntryDialog(){
    this._init.apply(this, arguments);
}

EntryDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(text, callback){
        ModalDialog.ModalDialog.prototype._init.call(this);
        this.entry = new St.Entry({
            name: "menu-search-entry",
            hint_text: text,
            track_hover: true,
            can_focus: true
        });
        this.contentLayout.add(this.entry);
        global.stage.set_key_focus(this.entry);

        this.setButtons([{
            label: _("OK"),
            action: bind(function(){
                let text = this.entry.get_text();
                this.destroy();
                callback(text);
            }, this)
        }]);
    }
}

function ProfileSwitcherApplet(){
    this._init.apply(this, arguments);
}

ProfileSwitcherApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId){
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_icon_symbolic_name("avatar-default");

        this.settings = {};
        this.settingProvider = new Settings.AppletSettings(this.settings, "profile-switcher@pixunil", instanceId);

        this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "active-profile", "activeProfile", bind(this.updateProfilesSection, this));
        this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "profiles", "profiles", bind(this.buildProfilesSection, this));

        this.gsettings = new Gio.Settings({schema: "org.cinnamon"});
        this.gsettingsChangedId = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.profilesSection = new PopupMenu.PopupMenuSection;
        this.menu.addMenuItem(this.profilesSection);

        this.buildProfilesSection();

        this.trackChanges = new PopupMenu.PopupSwitchMenuItem(_("Track changes"), false);
        this._applet_context_menu.addMenuItem(this.trackChanges);
        this.trackChanges.connect("toggled", bind(this.onTrackStateChanged, this));

        this.addProfile = new IconMenuItem(_("Add profile"), "list-add");
        this._applet_context_menu.addMenuItem(this.addProfile);
        this.addProfile.connect("activate", bind(this.onAddProfile, this));
    },

    buildProfilesSection: function(){
        let items = this.profilesSection._getMenuItems();
        let oldProfiles = {};
        for(let i = 0, l = items.length; i < l; ++i)
            oldProfiles[items[i].profileName] = items[i];

        for(let profile in this.settings.profiles){
            if(oldProfiles[profile]){
                delete oldProfiles[profile];
            } else if(profile !== "save"){
                let item = new ProfileMenuItem(this, profile);
                this.profilesSection.addMenuItem(item);
            }
        }

        for(let profile in oldProfiles)
            oldProfiles[profile].destroy();

        this.updateProfilesSection();
    },

    updateProfilesSection: function(){
        let items = this.profilesSection._getMenuItems();
        for(let i = 0, l = items.length; i < l; ++i)
            items[i].setShowDot(items[i].profileName === this.settings.activeProfile);
    },

    onTrackStateChanged: function(item){
        if(this.gsettingsChangedId)
            this.gsettings.disconnect(this.gsettingsChangedId);

        if(item.state)
            this.gsettingsChangedId = this.gsettings.connect("changed", bind(this.onGSettingsChanged, this));
        else
            this.gsettingsChangedId = null;

    },

    onGSettingsChanged: function(settings, key){
        let profile = this.settings.profiles[this.settings.activeProfile];

        if(profile[key] === undefined){
            let defaultValue = unpack(settings.get_default_value(key));
            for(let profile in this.settings.profiles){
                if(profile === this.settings.activeProfile)
                    continue;

                this.settings.profiles[profile][key] = defaultValue;
            }
        }

        let value = unpack(settings.get_value(key));
        profile[key] = value;

        this.settings.profiles.save();
    },

    onAddProfile: function(){
        let dialog = new EntryDialog(_("Profile name"), bind(function(text){
            this.settings.profiles[text] = {};
            this.settings.activeProfile = text;
            this.buildProfilesSection();
        }, this));
        dialog.open();
    },

    on_applet_clicked: function(){
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function(){
        if(this.gsettingsChangedId)
            this.gsettings.disconnect(this.gsettingsChangedId);
        this.settingProvider.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId){
    return new ProfileSwitcherApplet(orientation, panelHeight, instanceId);
}
