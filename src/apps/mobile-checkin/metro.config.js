// Metro configuration for Expo + pnpm monorepo.
// See https://docs.expo.dev/guides/monorepos/ for the rationale.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch every workspace package so Metro hot-reloads when shared code changes.
config.watchFolders = [workspaceRoot];

// pnpm hoists/sym-links dependencies into the workspace root's node_modules.
// Tell Metro to resolve from BOTH the project and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; Metro must follow them and respect package.json `exports`.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Workspace packages publish raw `.ts` source — make sure Metro accepts it.
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), 'ts', 'tsx', 'cjs', 'mjs']),
);

module.exports = config;
