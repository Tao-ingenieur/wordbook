# 一期验证记录

验证日期：2026-10-25（Asia/Shanghai）。

## 已完成

- Web 生产构建成功，输出 `dist/web`，包含本地 PDF Worker 和离线资源缓存。
- 微信小程序构建成功，输出 `dist/weixin`。
- App 资源构建成功，输出 `dist/app`；这是原生打包资源，不是 APK/IPA。
- Windows 便携文件夹已生成，入口为 `dist/desktop/Wordbook.exe`，无需安装；须保留同目录运行库。
- `node --test --test-isolation=none tests/*.test.mjs`：15 项通过，含开发/发布路径一致性与测试数据隔离检查。
- Electron 独立测试数据目录下冒烟检查：6 项通过，报告在 `dist/reports/desktop/desktop-smoke.json`，界面截图在 `dist/reports/desktop/desktop-preview.png`。

桌面检查覆盖：preload 与 input 目录扫描、卡片翻转、隐藏后退出队列、恢复生词、Excel 解析和脏数据默认剔除、本地文件协议下双栏 PDF 的 Worker 解析。检查启用 CSP 后再次通过。

目录整理后再次通过桌面检查。现有 `data/` 逐文件 SHA-256 与整理前一致；使用数据副本打开移动后的桌面资源，确认原有单词本与状态仍可读取。App 在 `.cache/` 内临时编译、发布到 `dist/app/` 的流程已实测通过。

浏览器实际交互已验证示例创建、卡片翻转、隐藏、恢复、Excel 文件选择、预览剔除及导入确认。

真实输入测试确认可以识别“中文释义”表头、独立词性列、多个工作表的重复词以及 PDF 双栏阅读顺序。PDF 的同行多词、断行、词根注释仍可能需要预览中人工修正；解析结果不能等同于已校对词库。

## 未验收

- iOS/Android 签名安装与真机测试，尤其 WebView 文件选择、本地 PDF Worker、系统语音、Android SAF 导出和 iOS 文件共享。
- 微信真实 AppID、插件授权、真机文件选择及朗读；当前未配置个人 AppID。
- 各系统英文语音包的实际听音质量。桌面数据逻辑和导入测试不替代听音测试。
- 扫描图片型 PDF 的 OCR 不属于当前实现；会提示先 OCR。

源码不包含云账号或同步服务；源文件与运行数据位于被 Git 忽略的 `dist/`。
