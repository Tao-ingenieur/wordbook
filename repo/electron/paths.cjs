const path = require('node:path');

function resolveDesktopPaths({ packaged, exePath, resourcesPath, sourceDir, portableDirectory, smoke = false }) {
  const desktop = packaged ? (portableDirectory || path.dirname(exePath)) : path.resolve(sourceDir, '../../dist/desktop');
  const dist = packaged ? path.dirname(desktop) : path.resolve(sourceDir, '../../dist');
  return {
    desktop, dist,
    input: path.join(dist, 'input'),
    userData: smoke ? path.join(dist, '.cache/desktop-smoke-data') : path.join(dist, 'data'),
    backups: path.join(dist, 'backups'),
    reports: path.join(dist, 'reports/desktop'),
    web: path.join(packaged ? resourcesPath : dist, 'web/index.html'),
  };
}
module.exports = { resolveDesktopPaths };
