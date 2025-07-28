#!/bin/sh

node data.mjs
zip tappdex.zip config.json icon.png index.html data/pokemon.json data/sprites/*
