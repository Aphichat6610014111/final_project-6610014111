const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const root = __dirname;
const config = getDefaultConfig(root);

// Prefer ESM fields so packages' "exports" and module entry points are used when available
config.resolver = config.resolver || {};
// mainFields determines the order of fields in package.json that Metro will use to resolve modules
config.resolver.mainFields = config.resolver.mainFields || ['module', 'browser', 'main'];

// Ensure metro resolves .js and .cjs files; prefer .js so ESM files are selected first
const sourceExts = new Set(config.resolver.sourceExts || ['js', 'jsx', 'ts', 'tsx', 'json']);
// Ensure .js is present and appears before .cjs
sourceExts.add('js');
sourceExts.add('cjs');
config.resolver.sourceExts = Array.from(sourceExts);

module.exports = config;
