const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb'); // anatomy meshes (assets/models)
module.exports = config;
