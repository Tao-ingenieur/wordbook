# 本地运行目录

| 目录 | 用途 |
| --- | --- |
| `desktop/` | Windows 免安装程序。双击 `desktop/Wordbook.exe` 启动，保留整个子目录。 |
| `web/` | Web 静态发布文件。通过 HTTP 服务打开。 |
| `weixin/` | 微信小程序编译文件。 |
| `app/` | iOS/Android 共用的原生打包资源，尚不是 APK/IPA。 |
| `input/` | 用户 Excel/PDF 源文件，一个文件对应一个单词本。 |
| `data/` | Windows 本地单词本、隐藏状态和设置。更新程序时保留。 |
| `backups/` | 手动导出 JSON 的默认位置，可在保存窗口改到其他目录。 |
| `previews/` | 源文件解析预览 JSON。 |
| `reports/` | 检查报告、调试截图等验证产物。 |
| `.cache/` | 下载、临时构建和独立测试数据。 |

程序文件与个人资料分开存放。更新 Windows 程序只需更新 `desktop/`，保留 `data/`。迁移整套个人环境时，复制 `desktop/`、`data/` 和需要的 `input/`；对外分发仅复制 `desktop/`，不附带个人资料。

整个 `dist/` 均不会上传 GitHub。目录与脚本说明见源码中的 `repo/README.md`。
