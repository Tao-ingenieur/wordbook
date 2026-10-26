# 拾词 Wordbook

跨平台本地单词本，一期实现中。源码、配置、测试与脚本均在 `repo/`；运行文件、输入资料与本地数据均在同级 `dist/`，根目录 `.gitignore` 已忽略整个 `dist/`。已有空 `respo/` 未改动。

## 开发与构建

需要 Node.js 22.13+（推荐 24）与 pnpm 10+。在 `repo/` 执行：

```powershell
pnpm install
pnpm dev                    # Web 开发服务，终端显示地址
pnpm serve                  # 构建后本机打开 http://127.0.0.1:4173
pnpm test                   # 数据模型、解析、备份测试
pnpm build                  # dist/web
pnpm build:weixin            # dist/weixin
pnpm build:app               # dist/app，供 HBuilderX 后续原生打包
pnpm desktop                # 先 build，再启动 Windows 桌面窗口
pnpm package:win            # dist/desktop/Wordbook.exe + 同目录运行库
pnpm package:android        # dist/android/Wordbook-debug.apk，需要 JDK 17 + Android SDK 35
pnpm scan                   # dist/input -> dist/previews/*.preview.json
```

`dist/web` 请用静态 HTTP 服务打开，不要直接双击 HTML。开发时可使用 `pnpm dev`；生产构建可使用 `pnpm serve`。HTTPS 或 localhost 首次加载后缓存应用资源，后续可离线打开；各浏览器数据独立。所有文件解析在设备内完成，不上传源文件。

Windows 程序位于 `dist/desktop/`，双击其中的 `Wordbook.exe` 无需安装，保留旁边的 DLL、locales、resources 等运行库。共享输入资料仍放在 `dist/input/`，通过“导入单词本 → 扫描 dist/input → 解析并预览”载入；单词本、隐藏状态和设置仍保存在 `dist/data/`，整理目录不迁移现有数据。手动导出默认保存到 `dist/backups/`，可以自行选择其他位置。

更新程序只更新 `desktop/`，不覆盖个人数据。迁移个人环境时一并复制同级的 `desktop/`、`data/`，如需源资料再复制 `input/`。对外共享只分发 `desktop/`，不附带个人 `data/`、`input/` 或 `backups/`。单独复制到其他位置的 `desktop/` 仍在其上一级创建和读取这些资料目录。

```text
dist/
  desktop/       Windows 程序与运行库
  web/           Web 发布文件
  weixin/        微信小程序文件
  app/           iOS/Android 共用原生打包资源
  android/       Android APK 与 SHA-256 校验文件
  input/         Excel/PDF 源资料
  data/          Windows 本地单词本、隐藏状态、设置（保持原位置）
  backups/       手动导出备份的默认位置
  previews/      解析预览 JSON
  reports/       验证报告和截图
  .cache/        临时构建、下载和独立测试数据
```

旧布局迁移：先关闭 Windows 程序，在 `repo/` 用 PowerShell 执行 `./scripts/organize-dist.ps1`，再运行 `pnpm package:win`。整理脚本只移动已知运行库、报告和临时目录，预先检查目标冲突，不移动 `input/` 和 `data/`。桌面检查入口为 `pnpm exec electron scripts/smoke-desktop.cjs`，测试报告位于 `dist/reports/desktop/`，使用 `.cache/` 下的独立数据目录。

其他维护入口：`node scripts/create-sample.mjs` 生成含脏数据的导入示例；`./scripts/download-electron.ps1` 在常规安装下载受限时获取并校验 Electron 官方发行包（PowerShell 7）；`scripts/configure-weixin.mjs` 用于配置实际 AppID 和朗读插件。上述脚本不在每次启动时执行，但用于开发、迁移或发布，属于保留的维护工具。

## 导入与更新规则

- 一个 Excel/PDF 文件生成一本单词本。Excel 读取所有工作表，推荐表头 `单词、音标、释义、例句`，允许中英文表头和不同列顺序；无表头时按上述四列读取。CSV 也可使用。
- PDF 读取文本层，按页面行位置重建文本。推荐每行一个单词，字段间用多空格、制表符或 `|` 分隔；复杂多栏、断行会出现待检查项。扫描 PDF 需要自行 OCR。
- 预览可编辑四个字段、逐行勾选。缺释义、重复、疑似无效单词默认不选；确认时拒绝选中的空词和重复词。未选择的行不会导入。
- 源文件身份为文件名（含扩展名，忽略大小写）。同名不同目录视为同一源；同名文件更新前会明确提示覆盖。文件改名会生成新本。
- 覆盖更新保留单词本 id、自定义名称和仍然存在词条的隐藏状态，替换释义/例句，移除不在新结果中的单词。复制本使用独立身份，不受源文件更新影响。
- `new` 表示生词；`hidden` 表示隐藏词。隐藏词不参加字母顺序或 Fisher–Yates 完全乱序队列，支持单独查看、逐个/全部恢复。发音不影响状态。
- 每本单词本分别记住字母顺序和乱序的当前位置，以及上次使用的排序方式。退出、关闭后再次进入会续背；乱序沿用保存的队列。“重新开始本轮”仅重置当前排序，乱序模式会重新洗牌。
- 隐藏或覆盖移除当前词后继续到下一个可背词；恢复或新增的词追加到已有乱序队列末尾，已有顺序不重排。覆盖更新保留仍可用的进度；复制本的进度独立。

## 备份

每本可以在菜单导出，也可在设置“导出全部数据”生成一个 JSON。这个文件同时包含所有独立单词本：例如三个本导出成一个 JSON，换手机导入后仍是三个本。备份含版本号、名称、来源标识、词条、隐藏状态、各本两套背诵进度及乱序队列。旧版无进度备份仍可导入，从头开始背诵。

通过文件选择或粘贴 JSON 恢复，先显示本数和词数确认；相同 id 或来源的本使用备份内容（含进度）替换，其他本保留，当前设备主题/字号不被合并操作覆盖。备份是导出时的快照，换设备前请重新导出最新数据；不会自动同步。

本地数据使用 `uni` 的同步存储 API；Web 对应浏览器存储，桌面对应便携目录内的 Chromium 数据。保存失败不会替换当前内存数据。数据损坏时阻止后续写入，提供原始数据导出与恢复入口。清除浏览器数据/卸载应用会丢失本地数据；无账号、无云同步。

## 平台边界与发布条件

| 平台 | 导入 | 发音 | 发布条件 |
| --- | --- | --- | --- |
| Web | Excel、CSV、文本 PDF、JSON | 浏览器系统 TTS，英文语音包可用时离线 | 静态服务 |
| Windows | 同 Web，另支持 input 目录扫描 | Chromium 系统 TTS | Electron portable 打包 |
| 微信小程序 | 聊天文件选择 Excel/CSV/JSON、粘贴 JSON；PDF 先电脑转换 | 已接入同声传译调用，需配置插件授权；使用网络合成 | 填写真实 AppID、微信开发者工具验证 |
| Android APK | 系统文档选择器导入 Excel/CSV/PDF/JSON，系统另存为导出；支持粘贴恢复 | 原生 TextToSpeech，需离线英文语音包 | Gradle / GitHub Actions 构建，无需 HBuilderX；调试签名 |
| iOS / uni-app 原生运行时 | WebView 文件选择器解析 Excel/CSV/PDF/JSON；Android SAF、iOS 文档目录导出 | 系统 TTS 桥接代码，尚待真机验证 | DCloud AppID、HBuilderX、签名与原生打包 |

小程序与 App 都不能访问电脑的 `dist/input`。可以先用 `pnpm scan` 生成预览 JSON，传给手机在导入页粘贴检查；也可导入电脑端正式导出的备份。

微信朗读配置：先在微信公众平台为自己的 AppID 添加同声传译插件（提供方 `wx069ba97219f66d99`），然后执行 `node scripts/configure-weixin.mjs <真实AppID> <平台显示的插件版本>`，重新构建小程序。默认不添加未经授权的插件。该服务只用于点击发音时合成当前单词，不承担单词本保存或同步。参考 [腾讯官方示例](https://github.com/Tencent/Face2FaceTranslator)。

Android 原生壳复用 Web 构建，完整脚本、安装、调试签名与升级说明见 [Android APK](docs/android.md)。`dist/app` 继续保留为 uni-app 打包资源，与 `dist/android` 的 APK 分开。

**当前属于一期可运行实现与多端工程基础，并非已经完成五端上线验收。** App 文件选择、本地 PDF Worker、系统 TTS、Android SAF 导出及微信插件授权都需要真机验证；各平台正式签名发布仍待完成。iOS 已配置文档共享，预期可通过“文件 → 我的 iPhone → 拾词”取出导出的 JSON，需签名安装后核验可见性。

架构依据：[uni-app CLI](https://uniapp.dcloud.net.cn/quickstart-cli)、[Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security/)、[SheetJS 官方安装](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/)。
