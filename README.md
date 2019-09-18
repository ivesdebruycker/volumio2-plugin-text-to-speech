# volumio2-plugin-text-to-speech

A Volumio plugin for text-to-speech using Amazon Polly.

Current features include automatic track announcement, a socket.io listener for messages to be read out loud ('tts-say' with payload {"text": "..."}) and one for announcing the current track ('tts-announce'). Works good with node-red.

Install will take a while, some dependencies need to be build.
You'l need an [AWS API key](http://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html) and secret, enter them in the plugin settings page.
Voice is configurable, see [API docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Polly.html#synthesizeSpeech-property) for valid ids.

Make sure you're able to play multiple simultaneous audio sources, for me this config works (Odroid C1, usb soundcard):

file `/etc/asound.conf`

```
pcm.custom
{
    type plug
    slave
    {
        pcm "dmix:2,0"
    }
}

ctl.custom
{
    type hw
    card card2
}
```

file `/etc/mpd.conf`
```
...
audio_output {
     type          "alsa"
     name          "alsa"
}
...
```

## Install dev version
* clone repo to `/data/plugins/miscellanea/text_to_speech`
* run `install.sh`
* activate plugin and configure

![volumio2-plugin-text-to-speech configuration](https://i.imgur.com/73Fk68j.png)
