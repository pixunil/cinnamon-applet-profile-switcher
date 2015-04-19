An applet for Cinnamon which lets you quickly switch between setting profiles

# Installation

Install the latest version via Cinnamon Applet Settings, or:

1. Download [`applet.js`](applet.js), [`metadata.json`](metadata.json) and [`settings-schema.json`](settings-schema.json)
2. Create a new directory `~/.local/share/cinnamon/applets/profile-switcher@pixunil`
3. Copy the files in this directory
4. Activate the applet in Cinnamon Settings

# Usage

## Profiles

Profiles are several settings configurations.
As default, this applet has got one default profile.
You may want to use profiles depending on your location and situation.

##### Examples

- normal: like you want and used to
- guest: no hot corners or other disturbing things
- presentation: no notifications, no osd, and a neutral wallpaper

## Creating Profiles

Right click on the applet or an existing profile and click "Add Profile".
Enter a name for your new profile and confirm with OK.

## Editing Profiles

Now you have got a new profile, you want to edit it, so change the configuration.
To do this, right click on the applet and toggle the switch "Track changes" on.
Now change your settings (with cinnamon-settings) as you want.

_Note_: Only those settings you change now are regocnized.
All settings that aren't touched, remain untouched, or in other words, are shared between all profiles.

After you finished, toggle the switch off.

## Using Profiles
Left click on the applet and then click on a profile.
Voilà, all the changes which have been tracked, are now applied.
