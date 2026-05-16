const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'packages', 'shared-mobile');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

// Ensure Metro resolves modules from this app's node_modules first,
// preventing duplicate React instances from parent directories.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
