const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'packages', 'shared-mobile');

const config = getDefaultConfig(projectRoot);

// Use classic (main-field) module resolution instead of package "exports".
// Metro 0.83's package-exports resolution is non-deterministic on a cold cache
// here: it mis-resolved the `react` specifier to `@types/react` (breaking the
// release bundle), and split `@tanstack/react-query` into two instances
// (ESM `import` vs CJS `require` conditions) — which caused the runtime
// "No QueryClient set" crash because the provider and the hooks ended up with
// different React Query contexts. Classic resolution honours each package's
// `react-native`/`main` field consistently for every importer, giving a single
// instance of React, React Query, etc.
config.resolver.unstable_enablePackageExports = false;

// Watch the shared package source
config.watchFolders = [sharedRoot];

// Don't use Watchman — it intermittently hangs on `watch-project` in this monorepo
// during release bundling. Metro falls back to a one-shot Node file crawl, which is
// reliable for builds. (Dev hot-reload still works, just via Node's watcher.)
config.resolver.useWatchman = false;

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

// Pin the bare `react` specifier to this app's real React entry. Independently of
// package-exports, Metro intermittently mis-resolves `react` to `@types/react`
// (empty `main`, no runtime entry) on a cold cache, which breaks the release
// bundle. Forcing it here is deterministic and keeps `react` a singleton.
const reactIndex = path.resolve(appModules, 'react', 'index.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { type: 'sourceFile', filePath: reactIndex };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
