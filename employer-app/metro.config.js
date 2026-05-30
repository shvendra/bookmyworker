const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'packages', 'shared-mobile');

const config = getDefaultConfig(projectRoot);

// Watch the shared package source
config.watchFolders = [sharedRoot];

// Always resolve node_modules from THIS app only — prevents duplicate React
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Force singleton packages to always resolve from this app's node_modules.
// This is the definitive fix for "multiple copies of React" in a monorepo
// where the shared package has its own node_modules installed.
const appModules = path.resolve(projectRoot, 'node_modules');
config.resolver.extraNodeModules = {
  'react':                                    path.resolve(appModules, 'react'),
  'react-native':                             path.resolve(appModules, 'react-native'),
  'react-native-safe-area-context':           path.resolve(appModules, 'react-native-safe-area-context'),
  'react-native-screens':                     path.resolve(appModules, 'react-native-screens'),
  'react-native-reanimated':                  path.resolve(appModules, 'react-native-reanimated'),
  'react-native-gesture-handler':             path.resolve(appModules, 'react-native-gesture-handler'),
  '@react-navigation/native':                 path.resolve(appModules, '@react-navigation/native'),
  '@react-navigation/bottom-tabs':            path.resolve(appModules, '@react-navigation/bottom-tabs'),
  '@react-navigation/native-stack':           path.resolve(appModules, '@react-navigation/native-stack'),
  '@react-navigation/elements':               path.resolve(appModules, '@react-navigation/elements'),
  '@react-navigation/routers':               path.resolve(appModules, '@react-navigation/routers'),
  '@react-navigation/stack':                  path.resolve(appModules, '@react-navigation/stack'),
  '@tanstack/react-query':                    path.resolve(appModules, '@tanstack/react-query'),
  '@tanstack/query-core':                     path.resolve(appModules, '@tanstack/query-core'),
  '@tanstack/react-query-persist-client':     path.resolve(appModules, '@tanstack/react-query-persist-client'),
  '@tanstack/query-async-storage-persister':  path.resolve(appModules, '@tanstack/query-async-storage-persister'),
  'expo':                                     path.resolve(appModules, 'expo'),
  'axios':                                    path.resolve(appModules, 'axios'),
  'socket.io-client':                         path.resolve(appModules, 'socket.io-client'),
  'i18next':                                  path.resolve(appModules, 'i18next'),
  'react-i18next':                            path.resolve(appModules, 'react-i18next'),
};

module.exports = config;
