const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { resolver } = config;

// Ensure wasm is treated as an asset so it can be loaded by the browser
resolver.assetExts.push('wasm');
resolver.sourceExts = resolver.sourceExts.filter((ext) => ext !== 'wasm');

// Ensure sql files are also treated as assets if we ship any pre-made databases (optional)
// resolver.assetExts.push('sql');

module.exports = config;
