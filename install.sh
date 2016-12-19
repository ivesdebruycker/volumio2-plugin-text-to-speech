#!/bin/bash

echo "Install NodeJS dependencies"
( cd /data/plugins/miscellanea/text_to_speech && npm install )
chown -R volumio:volumio /data/plugins/miscellanea/text_to_speech

echo "plugininstallend"