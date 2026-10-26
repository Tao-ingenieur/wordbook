import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('./src/manifest.json', import.meta.url), 'utf8'));
if (pkg.version !== manifest.versionName) throw Error('package.json 与 manifest.json 版本不一致');
const uni = uniModule.default || uniModule;
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_VERSION_CODE__: JSON.stringify(manifest.versionCode),
  },
  plugins: [uni()],
  build: { emptyOutDir: true },
});
