#!/bin/sh
mkdir dist
mkdir dist/data
mkdir dist/data/sprites

node data.mjs
cp data/pokemon.json dist/data/
cp index.html dist/
cp icon.png dist/
cp config.json dist/
cp data/sprites/* dist/data/sprites/

#cd dist
#zip ../tappdex.zip config.json icon.png index.html data/pokemon.json data/sprites/*
#cd ..
