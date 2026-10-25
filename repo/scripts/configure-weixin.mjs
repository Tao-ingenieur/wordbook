import fs from 'node:fs/promises';
const [appId, pluginVersion] = process.argv.slice(2);
if (!/^wx[a-z0-9]{16}$/i.test(appId || '') || !/^\d+\.\d+\.\d+$/.test(pluginVersion || '')) {
  console.error('用法：node scripts/configure-weixin.mjs wx真实16位AppID 微信同声传译插件版本号');
  console.error('在公众平台添加 wx069ba97219f66d99，填入平台显示的可用版本号。');
  process.exit(1);
}
const file = new URL('../src/manifest.json', import.meta.url);
const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
manifest['mp-weixin'].appid = appId;
manifest['mp-weixin'].plugins = { WechatSI: { version: pluginVersion, provider: 'wx069ba97219f66d99' } };
await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
console.log('微信 AppID 和同声传译插件配置已写入，请重新运行 pnpm build:weixin');
