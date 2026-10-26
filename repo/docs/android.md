# Android APK

Android 使用独立 Java WebView 壳复用 `dist/web`，由 Gradle 打包，不要求 HBuilderX 或 DCloud AppID。原有 `dist/app` 保留，供 uni-app 原生运行时与 iOS 后续打包；它不是 APK。

## 本机打包

需要 Node.js 24、pnpm 10、JDK 17、Android SDK Platform 35 和 Build Tools 35.0.0；接受 Android SDK 许可并设置 `JAVA_HOME`、`ANDROID_HOME`（或在 Android 工程的本地 `local.properties` 配置 `sdk.dir`）。在 `repo/` 执行：

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm package:android
```

脚本重新构建 Web，复制到 `dist/.cache/android-assets/www`，执行 Gradle 8.9 / Android Gradle Plugin 8.7.3 的 `assembleDebug`。最终输出：

- `dist/android/Wordbook-debug.apk`：可侧载的调试签名 APK。
- `dist/android/SHA256SUMS.txt`：APK 的 SHA-256。
- `dist/.cache/android/`：Gradle 构建中间文件。

GitHub Actions 的 **Android APK** 工作流在 main 推送后自动构建；完成后在该次运行的 Artifacts 下载 `wordbook-android`。构建不读取个人 `dist/input`、`dist/data` 或备份。CI 缓存调试证书以方便连续安装；不同环境或缓存丢失后生成的调试证书可能不同，无法覆盖安装时先导出数据再卸载旧版本。公开商店发布还需正式签名和发布验收。

## 安装和使用

Android 7.0+，需要较新的 Android System WebView / Chrome；旧系统自带的过时 WebView 可能不支持当前 PDF 解析器。将 APK 传到手机，允许对应文件管理器“安装未知应用”，点击安装。应用名为“拾词”，包名 `com.wordbook.app`。

应用资源全部内置，通过固定的本地 HTTPS 来源提供给 WebView，实际从 APK assets 读取，不访问网站。不申请联网或存储全盘访问权限。单词本、隐藏状态、两套背诵进度保存在此应用的本地存储；卸载和清除应用数据会删除这些内容。

- 导入：系统文档选择器选择 Excel、CSV、文本 PDF 或 JSON，由共享解析器在本机预览处理。
- 导出：系统“另存为”选择位置保存 JSON，支持取消与写入失败反馈。
- 发音：Android TextToSpeech，选择无需网络的英文语音；需先在系统设置安装相应离线英文语音包。缺失时应用会提示，不改用在线服务。
- 迁移：设置导出全部数据，一个 JSON 保留所有独立单词本及各自进度，换设备后手动导入。

Android 系统文件选择器可能提供网盘位置；选择远程文件的下载行为由对应文档提供应用负责。

## 验证与第三方组件

Node 测试覆盖导出桥接的成功、取消、异常与并发结果匹配。CI 编译 Java 与共享网页资源；模拟器检查启动、卡片与进度。手机厂商文件提供器、系统语音包和真实听音仍需真机确认。

当前 APK 对应源码 `25a2afa`，已通过 [Android 35 / Pixel 6 CI 检查](https://github.com/Tao-ingenieur/wordbook/actions/runs/40252676582)：安装启动、卡片显示、关闭重开续背、原生导出保存窗口和导入文件选择器的取消路径。文件实际读写、PDF 与离线听音仍待手机验收。

Gradle Wrapper 的脚本和 JAR 沿用已有 Sudoku 工程中的 Gradle 8.9 官方 Wrapper，保留 Apache-2.0 版权头。参考 [Gradle Wrapper](https://docs.gradle.org/8.9/userguide/gradle_wrapper.html)、[Android 本地 Web 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[Android TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)。
