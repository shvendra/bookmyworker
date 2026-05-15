const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'packages', 'shared-mobile');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

// Only resolve from this app's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Disable hierarchical lookup so Metro does NOT walk up into
// bookmyworkers-mobile/node_modules and load a second React instance.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
