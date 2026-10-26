# 拾词 Wordbook

跨平台、本地存储的单词本软件。支持文件导入预览、单词本管理、词条搜索编辑、翻转卡片、发音连播、断点续背、隐藏与撤销、手动备份差异恢复及本地恢复点。

- [`repo/`](repo/)：源码、构建脚本、配置和测试。
- `dist/`：本地运行文件、`input/` 源资料和设备数据，全部排除在 Git 之外。
- Windows 入口：`dist/desktop/Wordbook.exe`；现有单词本数据保持在 `dist/data/`。
- Android APK：`dist/android/Wordbook-debug.apk`，通过 Gradle / GitHub Actions 构建；[安装与打包说明](repo/docs/android.md)。
- [开发与使用说明](repo/README.md)
- [验证记录与平台限制](repo/VERIFICATION.md)

Web、Windows 便携版及微信/App 资源已构建验证。Android v0.2.2 APK 已通过 Android 35 / Pixel 6 模拟器的覆盖升级、词条操作、JSON 实际读写、PDF 导入、帮助页版本及中英切换持久化检查；旧版并存迁移已在 v0.2.0 验证。各端均可在右上角“帮助”查看版本与构建号，Windows 另有“帮助 → 关于拾词”菜单。基础设置支持中文 / English，Windows 菜单同步切换；界面角落不再显示版本号。旧版 Android 请先导出 JSON，在可并存的新版“拾词单词本”中导入；新版使用固定签名。iOS 签名打包、各移动端真机听音测试及微信朗读插件授权仍待完成。
