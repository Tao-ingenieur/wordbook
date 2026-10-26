# 一期验证记录

验证日期：2026-10-26（Asia/Shanghai）。

## 已完成

- Web 生产构建成功，输出 `dist/web`，包含本地 PDF Worker 和离线资源缓存。
- 微信小程序构建成功，输出 `dist/weixin`。
- App 资源构建成功，输出 `dist/app`；这是原生打包资源，不是 APK/IPA。
- Windows 便携文件夹已生成，入口为 `dist/desktop/Wordbook.exe`，无需安装；须保留同目录运行库。
- Android 固定调试签名 APK 已生成并下载到 `dist/android/Wordbook-debug.apk`，SHA-256 与构建清单一致。源码提交 `c7f31bf`，包名 `com.wordbook.offline`，版本 `0.2.1` / versionCode 202；构建来源、签名证书摘要及校验值在同目录 `build-info.json`、`SHA256SUMS.txt`。
- `node --test --test-isolation=none tests/*.test.mjs`：38 项通过，含开发/发布路径一致性、测试数据隔离、续背、词条编辑搜索、备份差异恢复、播放完成/取消和恢复点空间处理。
- Electron 独立测试数据目录下冒烟检查：15 项通过，报告在 `dist/reports/desktop/desktop-smoke.json`，界面截图在 `dist/reports/desktop/desktop-preview.png`、`word-manager-preview.png`、`about-desktop.png`、`about-mobile.png`。

桌面检查覆盖：preload 与 input 目录扫描、卡片翻转、隐藏后退出队列、恢复生词、Excel 解析和脏数据默认剔除、本地文件协议下双栏 PDF 的 Worker 解析。检查启用 CSP 后再次通过。

续背验证：桌面离开再进入、切换排序、页面重载后恢复当前词与位置；模型检查每本两套进度独立、乱序队列持久化、隐藏/恢复/覆盖后的队列修复、显式重开、复制本进度独立以及旧备份兼容。三个单词本导出到一个 JSON 再合并导入空设备数据，确认仍为三个独立单词本且各自进度与隐藏状态保留。测试不读写用户的 `dist/data/`。

Android 35 / Pixel 6 模拟器十一项检查通过：[GitHub Actions 40275048102](https://github.com/Tao-ingenieur/wordbook/actions/runs/40275048102)。覆盖固定签名及覆盖安装保留进度、安装启动与卡片显示、关闭重开续背、左右滑动、新增搜索跳转、撤销隐藏与队尾停止、JSON 实际写入 Downloads、选择 JSON 后比较恢复、真实文本 PDF 导入，以及帮助页版本/构建号与 Android 安装信息一致。报告和截图下载到 `dist/reports/android/`；旧包名并存和 JSON 迁移已在 v0.2.0 验证。

桌面补充检查覆盖连播完成回调与暂停、新增后按中文释义搜索、跳转、隐藏撤销、队尾不循环、键盘操作、编辑前恢复点、带导出时间的完整 JSON 与显式恢复选择；并断言新组件弹窗具有正确背景样式。播放逻辑使用可控发音回调测试，不替代实际听音。

实际 Android PDF 导入发现旧 WebView 缺少 `Promise.try` 会挂起，已将浏览器主库和 Worker 同时改为 PDF.js 同版本 legacy 构建，并加入超时退出，桌面与 Android PDF 回归均通过。卡片无障碍标签和 Android 15 系统边距也已验证修复。

Android 旧版 v0.1.0 的临时签名未实际缓存，密钥已无法恢复，不能覆盖安装。v0.2.0 更换为可并存的稳定包名，旧版数据保留，通过导出/导入 JSON 迁移。新版密钥密封后保存为 Actions Secret，已从 Secret 恢复并验证证书一致、覆盖安装数据保留。未把明文私钥放入源码或公共产物。

模拟器完整读写及 PDF 通过，仍不能等同于所有厂商设备已验证；各手机的文件提供器与离线英文语音包、真实听音质量需真机确认。

目录整理后再次通过桌面检查。现有 `data/` 逐文件 SHA-256 与整理前一致；使用数据副本打开移动后的桌面资源，确认原有单词本与状态仍可读取。App 在 `.cache/` 内临时编译、发布到 `dist/app/` 的流程已实测通过。

浏览器实际交互已验证示例创建、卡片翻转、隐藏、恢复、Excel 文件选择、预览剔除及导入确认。

真实输入测试确认可以识别“中文释义”表头、独立词性列、多个工作表的重复词以及 PDF 双栏阅读顺序。PDF 的同行多词、断行、词根注释仍可能需要预览中人工修正；解析结果不能等同于已校对词库。

## 未验收

- iOS 签名安装与真机测试；Android 厂商设备真机测试，尤其 WebView 文件选择、本地 PDF Worker、系统语音、Android SAF 导出和 iOS 文件共享。
- 微信真实 AppID、插件授权、真机文件选择及朗读；当前未配置个人 AppID。
- 各系统英文语音包的实际听音质量。桌面数据逻辑和导入测试不替代听音测试。
- 扫描图片型 PDF 的 OCR 不属于当前实现；会提示先 OCR。

源码不包含云账号或同步服务；源文件与运行数据位于被 Git 忽略的 `dist/`。

## 冗余检查（2026-10-26）

- 按 Web/App/小程序条件编译、Vue 模板引用、页面配置、Electron 和 CLI 入口核对源码引用；扫描 29 个 JS/Vue 文件，未发现未使用绑定、未引用业务模块或缺失的相对导入。此结果不等于形式化证明没有任何冗余。
- 三处 Excel 读取统一为 `core/excel.mjs`；浏览器与 Node 共用 PDF 逐页文本提取和文档释放逻辑。
- 删除 App 旧文件选择提示分支；按平台隔离文件选择处理函数和 iOS 语音实例；移除内部辅助函数的无用导出及 PDF 工具的转发导出。
- 移除未使用的 `vue-i18n` 直接依赖及对应锁文件条目；uni-app 自身的国际化运行时继续由框架提供。依赖精简后 Web、微信和 App 均构建通过。
- 微信导入 JSON 不再重复读取同一文件；一次性诊断/仓库设置脚本曾暂存 `dist/.cache/maintenance-archive/`，未纳入 Git，后续目录清理已删除。
- 15 项测试、6 项独立桌面检查再次通过。桌面应用资源已同步，正在运行的旧窗口需重启后加载新资源。

`node_modules/` 是安装依赖，生成的 PDF Worker 是构建资源，均已忽略 Git；`vendor/xlsx-0.20.3.tgz` 是安装清单引用的固定官方依赖包，不能作为重复源码删除。构建、迁移和验证脚本各有用途，予以保留。

本轮新增代码复查扫描 40 个 JS/Vue 文件，未发现未使用绑定或未引用的命名导出。公共页面样式移至 `src/styles/app.css`，由 App 全局加载，词条管理与备份比较组件共用，避免 uni-app 页面的自动作用域导致子组件样式缺失。

## 目录清理复核（2026-10-26）

- 删除 `dist/.cache/` 内旧 APK、失败检查产物、下载压缩包、临时脚本和独立测试数据，以及空的 `repo/.cache/`。删除根目录未使用的 `.pnpm-store/`（实际依赖 store 位于 `D:\.pnpm-store\v11`）。
- `reports/` 保留最新 Android、Windows 检查报告和截图，删除旧诊断报告、PDF 排版截图及测试生成的 PDF。
- Windows 打包改为完整替换网页资源，删除累积的旧哈希文件，并排除 Electron 默认示例 `default_app.asar`；当前 Windows 包已按新规则重新生成。
- 13 项隔离桌面检查通过；Windows 包内网页文件清单与内容逐项匹配 `dist/web/`，EXE 与依赖提供的 Electron 运行时哈希相同。
- 清理前后逐文件 SHA-256 核对：`input/`、`data/`、`backups/`、`previews/`、`android/`、`web/`、`app/`、`weixin/` 全部一致。源码依赖、固定 vendor 包、Gradle Wrapper、许可证及各平台当前产物保留。
