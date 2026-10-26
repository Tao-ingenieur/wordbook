<template>
  <view class="app" :class="[state.settings.theme, 'lang-' + locale]" :style="{ '--reading-size': state.settings.fontSize + 'px' }">
    <view class="sidebar">
      <view class="brand" @click="navigate('library')"><text class="brand-icon">拾</text><view><text class="brand-name">{{ t("拾词") }}</text><text class="brand-sub">WORDBOOK</text></view></view>
      <view class="nav"><button :class="{ active: page === 'library' || page === 'study' || page === 'hidden' }" @click="navigate('library')">{{ t("▤　我的单词本") }} <text class="nav-count">{{ state.books.length }}</text></button><button :class="{ active: page === 'import' }" @click="navigate('import')">{{ t("＋　导入单词本") }}</button><button :class="{ active: page === 'settings' }" @click="navigate('settings')">{{ t("⚙　基础设置") }}</button></view>
      <view class="sidebar-bottom"><view class="local-dot">{{ t("●　数据仅保存在此设备") }}</view><text>{{ t("一点积累，一点进步。") }}</text></view>
    </view>
    <view class="main">
      <view class="topbar"><text>{{ pageTitle }}</text><view class="top-actions"><button class="text-btn" @click="navigate('help')">{{ t("帮助") }}</button><text class="offline">{{ t("● 本地存储") }}</text><button class="icon-btn" :aria-label="t(&quot;切换主题&quot;)" @click="toggleTheme">{{ state.settings.theme === 'dark' ? '☀' : '☾' }}</button></view></view>
      <view v-if="fatal" class="notice error">{{ t(fatal) }}<button @click="exportRaw">{{ t("导出原始数据") }}</button></view>
      <view v-if="page === 'library'" class="content">
        <view class="page-heading"><view><text class="eyebrow">YOUR PERSONAL VOCABULARY</text><text class="title">{{ t("把遇见的单词，变成自己的。") }}</text><text class="subtitle">{{ t("从一本单词本开始，按自己的节奏积累。") }}</text></view><button class="primary" @click="navigate('import')">{{ t("＋ 导入单词本") }}</button></view>
        <view class="stats"><view><text class="stat-label">{{ t("我的单词本") }}</text><text class="stat-value">{{ state.books.length }}<text> {{ t("本") }}</text></text></view><view><text class="stat-label">{{ t("全部词汇") }}</text><text class="stat-value">{{ total }}<text> {{ t("词") }}</text></text></view><view><text class="stat-label">{{ t("待记生词") }}</text><text class="stat-value purple">{{ fresh }}<text> {{ t("词") }}</text></text></view><view><text class="stat-label">{{ t("已隐藏") }}</text><text class="stat-value">{{ total - fresh }}<text> {{ t("词") }}</text></text></view></view>
        <view v-if="backupDue" class="notice backup-reminder">{{ t("已有单词本尚未导出，或距上次导出超过 7 天。请在换设备前导出最新备份。") }}<button class="text-btn" @click="exportAll">{{ t("现在导出全部数据") }}</button></view>
        <view class="section-heading"><view><text class="section-title">{{ t("我的单词本") }}</text><text class="muted">{{ state.books.length }} {{ t("本") }}</text></view><input class="search" v-model="search" :placeholder="t(&quot;搜索单词本…&quot;)" :aria-label="t(&quot;搜索单词本&quot;)" /></view>
        <view v-if="!state.books.length" class="empty"><view class="empty-icon">Aa</view><text class="section-title">{{ t("你的词汇收藏，从这里开始") }}</text><text class="muted">{{ t("导入 Excel 或 PDF，每个文件成为一本独立的单词本。") }}</text><button class="primary" @click="navigate('import')">{{ t("导入第一本单词本") }}</button><button class="text-btn" @click="addDemo">{{ t("先用示例体验") }}</button></view>
        <view v-else-if="!filteredBooks.length" class="empty"><text>{{ t("没有找到匹配的单词本") }}</text></view>
        <view v-else class="book-grid"><view v-for="(book, i) in filteredBooks" :key="book.id" class="book"><view class="book-top"><view class="book-symbol" :class="'color-' + i % 3">Aa</view><button class="icon-btn" :aria-label="t(&quot;管理&quot;) + book.name" @click="manage(book)">•••</button></view><text class="book-name">{{ book.name }}</text><text class="book-source">{{ book.sourceKey.startsWith('copy:') ? t("独立副本") : book.sourceKey.startsWith('demo:') ? t("示例单词本") : t("文件导入") }} · {{ formatDate(book.updatedAt) }}</text><view class="book-count"><text>{{ book.entries.length }} <text class="muted">{{ t("总词数") }}</text></text><text class="purple">{{ countNew(book) }} <text class="muted">{{ t("生词") }}</text></text></view><view class="progress"><view :style="{ width: (book.entries.length ? (book.entries.length - countNew(book)) / book.entries.length * 100 : 0) + '%' }" /></view><view class="book-search"><button class="text-btn" @click="openManager(book)">{{ t("搜索与编辑词条") }}</button></view><view class="book-footer"><button class="text-btn muted" @click="openHidden(book)">{{ t("隐藏词") }} {{ book.entries.length - countNew(book) }}</button><button class="start-btn" @click="startStudy(book)">{{ book.study?.[book.study.mode] ? t("继续背诵 →") : t("开始背诵 →") }}</button></view></view></view>
        <view class="tip"><text>✧</text><text>{{ t("记住了，就藏起来。把每一次复习留给还不熟悉的单词。") }}</text></view>
      </view>
      <view v-else-if="page === 'import'" class="content">
        <view class="page-heading"><view><text class="eyebrow">BUILD YOUR COLLECTION</text><text class="title">{{ t("导入单词本") }}</text><text class="subtitle">{{ t("先检查，再收藏。每个源文件对应一本单词本。") }}</text></view></view>
        <view class="import-panel"><view class="empty-icon">↥</view><text class="section-title">{{ t("让你的词汇资料，成为单词卡片") }}</text><text class="muted">{{ t("Excel / CSV / 文本 PDF / 单词本 JSON · 最大 30 MB") }}</text>
          <!-- #ifndef APP-PLUS -->
          <button class="primary" :disabled="busy" @click="choose">{{ busy ? t("正在解析…") : t("选择文件") }}</button>
          <!-- #endif -->
          <!-- #ifdef APP-PLUS -->
          <app-file-picker :busy="busy" @busy="busy = $event" @document="onAppDocument" @error="toast" />
          <!-- #endif -->
          <view class="import-options"><button class="text-btn" @click="showPaste = true">{{ t("粘贴 JSON 恢复") }}</button><button v-if="isDesktop" class="text-btn" @click="scanInput">{{ t("扫描 dist/input") }}</button></view></view>
        <view v-if="inputFiles.length" class="panel"><text class="section-title">{{ t("输入目录文件") }}</text><view v-for="file in inputFiles" :key="file" class="file-row"><text>{{ file }}</text><button class="secondary" :disabled="busy" @click="readInput(file)">{{ t("解析并预览") }}</button></view></view>
        <view class="panel instructions"><text class="section-title">{{ t("导入说明") }}</text><text>{{ t("01　Excel 推荐表头：单词 / 音标 / 释义 / 例句；自动读取所有工作表。") }}</text><text>{{ t("02　无表头时按上述四列读取；PDF 推荐每行一个词，列间保留空白。") }}</text><text>{{ t("03　同名文件覆盖原单词本内容，保留仍存在词条的隐藏状态；被剔除的词条会从原本移除。") }}</text><text>{{ t("04　扫描图片型 PDF 请先 OCR。手机不能扫描电脑目录，可导入电脑导出的 JSON。") }}</text><text>{{ t("05　微信端支持从聊天文件选择 Excel / JSON；PDF 请先用电脑生成预览 JSON。") }}</text></view>
      </view>
      <view v-else-if="page === 'study' && currentBook" class="content study-content">
        <view class="study-heading"><button class="text-btn" @click="navigate('library')">{{ t("← 我的单词本") }}</button><view class="study-links"><button class="text-btn" @click="openManager(currentBook)">{{ t("搜索与编辑词条") }}</button><button class="text-btn" @click="openHidden(currentBook)">{{ t("隐藏词") }} {{ currentBook.entries.length - countNew(currentBook) }}</button></view></view>
        <view class="study-title"><text class="title">{{ currentBook.name }}</text><text class="muted">{{ t("只与还不熟悉的单词相遇") }}</text></view>
        <view class="study-controls"><view class="segmented"><button :class="{ selected: order === 'alpha' }" @click="changeOrder('alpha')">{{ t("A–Z 字母顺序") }}</button><button :class="{ selected: order === 'random' }" @click="changeOrder('random')">{{ t("⇄ 完全乱序") }}</button></view><text class="muted">{{ queue.length ? cursor + 1 : 0 }} / {{ queue.length }}</text></view>
        <view class="resume-bar"><text class="muted">{{ t("进度自动保存 · 两种排序分别记忆") }}</text><button class="text-btn" @click="restartStudy">{{ t("重新开始本轮") }}</button></view>
        <view v-if="playbackAvailable && currentEntry" class="playback-bar"><button class="secondary" @click="togglePlayback">{{ playing ? t("暂停连播") : t("开始连播") }}</button><text class="muted">{{ t("每词") }} {{ state.settings.repeat }} {{ t("次 · 间隔") }} {{ state.settings.interval }} {{ t("秒 ·") }} {{ state.settings.rate }} {{ t("倍语速") }}</text></view>
        <view v-if="undo && undo.bookId === activeId" class="notice undo-bar"><text>{{ t("已隐藏") }} {{ undo.word }}</text><button class="text-btn" @click="undoHide">{{ t("撤销隐藏") }}</button></view>
        <view v-if="currentEntry" class="flashcard" :class="{ flipped }" @click="flipCard" @touchstart="touchStart" @touchend="touchEnd" @touchcancel="swipeStart = null" role="button" :aria-label="flipped ? currentEntry.word + '，' + currentEntry.phonetic + '，' + currentEntry.meaning + '，' + currentEntry.example + t(&quot;，翻到单词正面&quot;) : currentEntry.word + t(&quot;，翻看释义&quot;)"><view class="card-top"><text>{{ flipped ? t("释义 · DEFINITION") : t("单词 · WORD") }}</text><button class="sound" :aria-label="t(&quot;播放发音&quot;)" @click.stop="pronounce(currentEntry.word)">♫</button></view><view class="card-body"><text class="card-word">{{ currentEntry.word }}</text><template v-if="flipped"><text class="phonetic">{{ currentEntry.phonetic || t("暂无音标") }}</text><text class="meaning">{{ currentEntry.meaning || t("暂无释义") }}</text><text class="example">{{ currentEntry.example || t("暂无例句") }}</text></template><text v-else class="flip-hint">{{ t("轻触卡片，查看释义与例句") }}</text></view><text class="card-bottom">↻ {{ flipped ? t("点击返回单词") : t("点击翻转卡片") }}</text></view>
        <view v-else class="empty panel"><text class="empty-icon">✓</text><text class="section-title">{{ t("这本单词本没有待记生词了") }}</text><button class="primary" @click="openHidden(currentBook)">{{ t("查看隐藏词，恢复复习") }}</button></view>
        <view v-if="currentEntry" class="study-buttons"><button class="secondary" @click="step(-1)">{{ t("← 上一个") }}</button><button class="hide-btn" @click="hideCurrent">{{ t("✓ 已记住，隐藏") }}</button><button class="primary" :disabled="completed" @click="step(1)">{{ completed ? t("本轮已完成") : t("下一个 →") }}</button></view><text v-if="currentEntry" class="study-note">{{ t("隐藏的单词将退出背诵轮询，随时可恢复。电脑 ← → 切词、空格翻面；手机左右滑动切词。") }}</text>
      </view>
      <view v-else-if="page === 'hidden' && currentBook" class="content"><button class="text-btn" @click="startStudy(currentBook)">{{ t("← 返回背诵") }}</button><view class="page-heading"><view><text class="title">{{ t("隐藏词") }}</text><text class="subtitle">{{ currentBook.name }} · {{ hiddenEntries.length }} {{ t("词，恢复后将重新参与背诵。") }}</text></view><button v-if="hiddenEntries.length" class="secondary" @click="restoreAll">{{ t("全部恢复") }}</button></view><view v-if="!hiddenEntries.length" class="empty panel"><text>{{ t("还没有隐藏的单词") }}</text></view><view v-else class="panel"><view v-for="entry in hiddenEntries" :key="entry.id" class="hidden-row"><view><text class="hidden-word">{{ entry.word }}</text><text class="muted">{{ entry.meaning }}</text></view><button class="secondary" @click="restore(entry.id)">{{ t("恢复为生词") }}</button></view></view></view>
      <view v-else-if="page === 'help'" class="content help-content">
        <view class="page-heading"><view><text class="eyebrow">HELP &amp; ABOUT</text><text class="title">{{ t("帮助与关于") }}</text><text class="subtitle">{{ t("拾词 · Wordbook") }}</text></view></view>
        <view class="panel about-panel"><text class="section-title">{{ t("拾词单词本") }}</text><text class="app-version">{{ t("版本") }} {{ appVersion }}</text><text class="muted">{{ t("构建号") }} {{ appBuild }}</text><text class="subtitle">{{ t("本地单词本，按自己的节奏积累。此页面的版本属于当前正在运行的程序。") }}</text></view>
        <view class="panel instructions"><text class="section-title">{{ t("开始使用") }}</text><text>{{ t("导入 Excel、CSV 或文本 PDF，检查预览后确认；一个源文件对应一本单词本。微信端的 PDF 请先在电脑转换。") }}</text><text>{{ t("进入单词本后可按字母顺序或乱序背诵，两种排序分别记住进度。点击卡片翻看释义；已掌握的词可隐藏，也能恢复。") }}</text><text>{{ t("电脑支持左右方向键切词、空格翻面；手机可在卡片上左右滑动。") }}</text></view>
        <view class="panel instructions"><text class="section-title">{{ t("离线与发音") }}</text><text>{{ t("单词本保存在当前设备。Windows 和 APK 可离线背诵；Web 首次加载并缓存后可离线打开。") }}</text><text>{{ t("发音使用系统或浏览器语音服务，离线朗读需要已安装英文离线语音包；微信朗读需要网络。") }}</text></view>
        <view class="panel instructions"><text class="section-title">{{ t("备份与换设备") }}</text><text>{{ t("基础设置 → 导出全部数据，可将所有单词本、隐藏状态和进度保存为一个 JSON；在另一台设备导入恢复，并逐本选择保留、合并或覆盖。") }}</text><text>{{ t("没有云端自动同步。卸载应用或清除应用数据前，请先导出备份；本地恢复点不能代替跨设备备份。") }}</text><button class="secondary" @click="navigate('settings')">{{ t("打开基础设置") }}</button></view>
      </view>
      <view v-else-if="page === 'settings'" class="content settings"><view class="page-heading"><view><text class="eyebrow">MAKE IT YOURS</text><text class="title">{{ t("基础设置") }}</text><text class="subtitle">{{ t("舒服的阅读节奏，让记忆更轻松。") }}</text></view></view><view class="panel"><view class="setting-row"><view><text class="section-title">{{ t('界面语言') }}</text><text class="subtitle">{{ t('语言切换只影响界面，不翻译单词本内容。') }}</text></view><view class="segmented language-options"><button :class="{ selected: locale === 'zh' }" @click="changeLanguage('zh')">中文</button><button :class="{ selected: locale === 'en' }" @click="changeLanguage('en')">English</button></view></view></view><view class="panel"><view class="setting-row"><view><text class="section-title">{{ t("外观主题") }}</text><text class="muted">{{ t("随时在浅色和深色之间切换") }}</text></view><view class="segmented"><button :class="{ selected: state.settings.theme === 'light' }" @click="setTheme('light')">{{ t("☀ 浅色") }}</button><button :class="{ selected: state.settings.theme === 'dark' }" @click="setTheme('dark')">{{ t("☾ 深色") }}</button></view></view><view class="setting-row"><view><text class="section-title">{{ t("卡片字体大小") }}</text><text class="muted">{{ state.settings.fontSize }} px</text></view><slider :value="state.settings.fontSize" :min="14" :max="28" :step="1" activeColor="#7563d9" @change="setFont($event.detail.value)" /></view><view class="font-preview" :style="{ fontSize: state.settings.fontSize + 'px' }">Every word is a new beginning.<text v-if="locale === 'zh'">{{ t("每一个单词，都是新的开始。") }}</text></view></view><view v-if="playbackAvailable" class="panel"><text class="section-title">{{ t("发音与连续播放") }}</text><view class="setting-row"><text>{{ t("进入卡片自动发音") }}</text><switch :checked="state.settings.autoPronounce" @change="setPlayback('autoPronounce', $event.detail.value)" /></view><view class="setting-row"><text>{{ t("每词朗读") }} {{ state.settings.repeat }} {{ t("次") }}</text><slider :value="state.settings.repeat" :min="1" :max="3" :step="1" @change="setPlayback('repeat', $event.detail.value)" /></view><view class="setting-row"><text>{{ t("朗读间隔") }} {{ state.settings.interval }} {{ t("秒") }}</text><slider :value="state.settings.interval" :min="1" :max="15" :step="1" @change="setPlayback('interval', $event.detail.value)" /></view><view class="setting-row"><text>{{ t("语速") }} {{ state.settings.rate }} {{ t("倍") }}</text><slider :value="Math.round(state.settings.rate * 100)" :min="50" :max="150" :step="5" @change="setPlayback('rate', $event.detail.value / 100)" /></view><text class="muted">{{ t("连播在每次朗读结束后等待，再播放下一词；离开页面、切到后台或遇到发音错误会暂停。到队尾停止。") }}</text></view><view class="panel"><text class="section-title">{{ t("关于拾词") }}</text><button class="text-btn" @click="navigate('help')">{{ t("帮助与关于") }}</button></view><view class="panel"><text class="section-title">{{ t("数据与备份") }}</text><text class="subtitle">{{ t("一个 JSON 备份全部单词本、隐藏状态与背诵进度，换设备导入后仍保留各本。请定期导出。") }}</text><view class="import-options"><button class="primary" @click="exportAll">{{ t("导出全部数据") }}</button><button class="secondary" @click="navigate('import')">{{ t("导入备份恢复") }}</button><button class="secondary" @click="recoveryOpen = true">{{ t("本地恢复点") }}</button></view><text class="subtitle">{{ exportedAt ? t("上次发起导出：") + exportedAt.replace('T', ' ').slice(0, 16) : t("尚未导出过全部数据") }}{{ t("。本地恢复点不随 JSON 导出，不能跨设备同步。") }}</text></view></view>
    </view>
    <view v-if="preview" class="overlay"><view class="modal wide"><view class="modal-heading"><view><text class="section-title">{{ t("检查导入内容") }}</text><text class="muted">{{ preview.entries.length }} {{ t("条解析结果 · 选中") }} {{ selectedCount }} {{ t("条") }}</text></view><button class="icon-btn" :aria-label="t(&quot;关闭预览&quot;)" @click="preview = null">×</button></view><input v-model="preview.name" :disabled="!!replacing" class="name-input" :placeholder="t(&quot;单词本名称&quot;)" :aria-label="t(&quot;单词本名称&quot;)" /><text v-if="replacing" class="notice">{{ t("将覆盖「") }}{{ replacing.name }}{{ t("」：未选中的词条会移除；已有隐藏状态保留。") }}</text><view class="preview-actions"><button class="text-btn" @click="selectPreview(true)">{{ t("全选") }}</button><button class="text-btn" @click="selectPreview(false)">{{ t("全不选") }}</button><text class="muted">{{ t("警告行默认不选；可编辑修正后勾选。") }}</text></view><scroll-view scroll-y class="preview-list"><view v-for="row in previewRows" :key="row.reviewId" class="preview-row" :class="{ excluded: !row.selected }"><button class="check" :class="{ checked: row.selected }" :aria-label="(row.selected ? t(&quot;剔除 &quot;) : t(&quot;保留 &quot;)) + row.word" @click="row.selected = !row.selected">{{ row.selected ? '✓' : '−' }}</button><view class="preview-fields"><input v-model="row.word" :maxlength="-1" :placeholder="t(&quot;单词&quot;)" :aria-label="t(&quot;词条单词&quot;)" /><input v-model="row.phonetic" :maxlength="-1" :placeholder="t(&quot;音标&quot;)" :aria-label="t(&quot;词条音标&quot;)" /><input v-model="row.meaning" :maxlength="-1" :placeholder="t(&quot;释义&quot;)" :aria-label="t(&quot;词条释义&quot;)" /><input v-model="row.example" :maxlength="-1" :placeholder="t(&quot;例句&quot;)" :aria-label="t(&quot;词条例句&quot;)" /><text class="row-warning">{{ locationText(row.location) }} {{ warningText(row.warning) }}</text></view></view></scroll-view><view class="preview-pagination"><button class="text-btn" :disabled="previewPage <= 1" @click="previewPage--">{{ t("← 上一页") }}</button><text class="muted">{{ previewPage }} / {{ previewPages }} {{ t("页 · 每页 50 条") }}</text><button class="text-btn" :disabled="previewPage >= previewPages" @click="previewPage++">{{ t("下一页 →") }}</button></view><view class="modal-footer"><button class="secondary" @click="preview = null">{{ t("取消") }}</button><button class="primary" :disabled="!selectedCount || !!fatal" @click="commitImport">{{ replacing ? t("确认覆盖更新") : t("创建单词本") }}</button></view></view></view>
    <view v-if="showPaste" class="overlay"><view class="modal"><text class="section-title">{{ t("粘贴单词本 JSON") }}</text><text class="subtitle">{{ t("支持备份文件或电脑扫描生成的预览文件内容。") }}</text><textarea class="paste-area" v-model="pasteText" :placeholder="t(&quot;粘贴 JSON 内容&quot;)" :maxlength="-1" /><view class="modal-footer"><button class="secondary" @click="showPaste = false">{{ t("取消") }}</button><button class="primary" @click="parsePasted">{{ t("检查内容") }}</button></view></view></view>
    <backup-review v-if="restoreDraft" :current="state" :backup="restoreDraft" @close="restoreDraft = null" @restore="commitRestore" />
    <word-manager v-if="managerOpen && currentBook" :book="currentBook" :save-book="saveManagedBook" @close="managerOpen = false" @jump="jumpTo" />
    <view v-if="summaryOpen && page === 'study' && !managerOpen" class="overlay"><view class="modal"><text class="section-title">{{ t("本轮已完成") }}</text><text class="subtitle">{{ currentBook.name }} · {{ order === 'alpha' ? t("字母顺序") : t("完全乱序") }}{{ t("已到队尾。本次队列剩余") }} {{ queue.length }} {{ t("个生词，已隐藏") }} {{ currentBook.entries.length - countNew(currentBook) }} {{ t("词。下次进入会保留完成状态，不会自动循环。") }}</text><view class="modal-footer"><button class="secondary" @click="summaryOpen = false">{{ t("继续查看") }}</button><button class="primary" @click="restartStudy">{{ t("重新开始本轮") }}</button><button class="secondary" @click="navigate('library')">{{ t("返回单词本") }}</button></view></view></view>
    <view v-if="recoveryOpen" class="overlay"><view class="modal"><view class="modal-heading"><text class="section-title">{{ t("本地恢复点") }}</text><button class="icon-btn" :aria-label="t(&quot;关闭恢复点&quot;)" @click="recoveryOpen = false">×</button></view><text class="notice">{{ t("最多保留两个恢复点，空间不足时只留最近一个；首次保存、每日首次修改及编辑、删除、覆盖前自动创建。与应用数据在同一设备，卸载或清除数据会同时丢失，不能代替导出 JSON。") }}</text><view v-for="(point, pointIndex) in points" :key="point.at + pointIndex" class="file-row"><text>{{ t(point.reason) }} · {{ point.at.replace('T', ' ').slice(0, 19) }}</text><view><button class="text-btn" @click="restorePoint(point)">{{ t("比较并恢复") }}</button><button class="text-btn" @click="exportPoint(point)">{{ t("导出此恢复点") }}</button></view></view><button v-if="points.length" class="text-btn" @click="clearPoints">{{ t("清理恢复点释放空间") }}</button><text v-if="!points.length" class="subtitle">{{ t("尚无恢复点；后续修改数据时自动创建。") }}</text></view></view>
    <view v-if="renameDraft" class="overlay"><view class="modal"><text class="section-title">{{ t("重命名单词本") }}</text><input class="name-input" v-model="renameDraft.name" :maxlength="100" /><view class="modal-footer"><button class="secondary" @click="renameDraft = null">{{ t("取消") }}</button><button class="primary" @click="commitRename">{{ t("保存名称") }}</button></view></view></view>
    <view v-if="busy" class="busy-indicator">{{ t("正在解析文件，请稍候…") }}</view>
  </view>
</template>

<script setup>
import { t, showModal, locale, setLocale, locationText, warningText } from '../../i18n/index.js';

import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import { emptyState, importBook, copyBook, reconcileStudy, studySession, rememberStudy, validateBackup, reopenStudy, keyOf } from '../../core/model.mjs';
import { reviewEntries } from '../../core/parse.mjs';
import { loadState, saveState, rawState, recoveryPoints, lastExport, recordExport, clearRecoveryPoints } from '../../platform/storage.js';
import { restoreWithChoices, stepSession } from '../../core/book-tools.mjs';
import { createPlayer } from '../../core/player.mjs';
import WordManager from '../../components/word-manager.vue';
import BackupReview from '../../components/backup-review.vue';
import { exportFile, desktop, readDocument } from '../../platform/files.js';
// #ifndef APP-PLUS
import { pickFile } from '../../platform/files.js';
// #endif
import { speak, stopSpeech, canAutoPlay } from '../../platform/speech.js';
// #ifdef APP-PLUS
import AppFilePicker from '../../components/app-file-picker.vue';
// #endif
const appVersion = __APP_VERSION__, appBuild = __APP_VERSION_CODE__;
const state = ref(emptyState()), fatal = ref('');
try { state.value = loadState(); } catch (e) { fatal.value = e.message; }
const page = ref('library'), search = ref(''), busy = ref(false), preview = ref(null), inputFiles = ref([]), isDesktop = !!desktop();
const activeId = ref(''), queue = ref([]), cursor = ref(0), flipped = ref(false), order = ref('alpha');
const showPaste = ref(false), pasteText = ref(''), restoreDraft = ref(null), renameDraft = ref(null);
const previewPage = ref(1);
const managerOpen = ref(false), recoveryOpen = ref(false), completed = ref(false), summaryOpen = ref(false), undo = ref(null), playing = ref(false);
const points = ref(recoveryPoints()), exportedAt = ref(lastExport());
const backupDue = computed(() => state.value.books.length > 0 && (!exportedAt.value || Date.now() - Date.parse(exportedAt.value) > 7 * 86400000));
const playbackAvailable = canAutoPlay();
let voiceRun = 0, swipeStart = null, swipedAt = 0;
let lastBackupWarning = '';
const player = createPlayer({ speak, stopSpeech });
const previewPages = computed(() => Math.max(1, Math.ceil((preview.value?.entries.length || 0) / 50)));
const previewRows = computed(() => preview.value?.entries.slice((previewPage.value - 1) * 50, previewPage.value * 50) || []);
const pageTitle = computed(() => ({ library: t("我的单词本"), import: t("导入单词本"), settings: t("基础设置"), help: t("帮助与关于"), study: t("单词卡片"), hidden: t("隐藏词列表") }[page.value]));
const total = computed(() => state.value.books.reduce((n, b) => n + b.entries.length, 0));
const fresh = computed(() => state.value.books.reduce((n, b) => n + countNew(b), 0));
const filteredBooks = computed(() => state.value.books.filter(b => b.name.toLowerCase().includes(search.value.toLowerCase())));
const currentBook = computed(() => state.value.books.find(b => b.id === activeId.value));
const currentEntry = computed(() => currentBook.value?.entries.find(e => keyOf(e.word) === queue.value[cursor.value]));
const hiddenEntries = computed(() => currentBook.value?.entries.filter(e => e.status === 'hidden') || []);
const selectedCount = computed(() => preview.value?.entries.filter(e => e.selected).length || 0);
const replacing = computed(() => state.value.books.find(b => b.sourceKey === preview.value?.sourceKey));
const countNew = b => b.entries.filter(e => e.status === 'new').length;
const formatDate = value => value?.slice(0, 10).replaceAll('-', '.') || '';
const toast = title => uni.showToast({ title: t(title), icon: 'none', duration: 3000 });
function commit(next, options) {
  if (fatal.value) { toast(fatal.value); return false; }
  try { const warning = saveState(next, options); state.value = next; points.value = recoveryPoints(); if (warning && warning !== lastBackupWarning) toast(warning); lastBackupWarning = warning; return true; } catch (e) { toast(e.message || t("保存失败，请先导出备份。")); return false; }
}
function navigate(target) { stopPlayback(); managerOpen.value = false; undo.value = null; page.value = target; nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 })); }
function updateBook(fn) { return commit({ ...state.value, books: state.value.books.map(b => b.id === activeId.value ? reconcileStudy(fn({ ...b, updatedAt: new Date().toISOString(), entries: b.entries.map(e => ({ ...e })) })) : b) }); }
function changeLanguage(value) { try { setLocale(value); } catch (e) { toast(e.message); } }
watch(locale, value => {
  // #ifdef H5
  document.title = value === 'en' ? 'Wordbook' : '拾词 · Wordbook';
  document.documentElement.lang = value === 'en' ? 'en' : 'zh-CN';
  desktop()?.setLanguage?.(value)?.catch(error => toast(error.message));
  // #endif
  uni.setLocale?.(value === 'en' ? 'en' : 'zh-Hans');
}, { immediate: true });
function setTheme(theme) { commit({ ...state.value, settings: { ...state.value.settings, theme } }); }
function toggleTheme() { setTheme(state.value.settings.theme === 'dark' ? 'light' : 'dark'); }
function setFont(fontSize) { commit({ ...state.value, settings: { ...state.value.settings, fontSize } }); }
function showSession(session) { order.value = session.mode; queue.value = session.queue; cursor.value = session.cursor; completed.value = !!session.completed; summaryOpen.value = completed.value; flipped.value = false; }
function saveSession(book, session) {
  const next = rememberStudy(book, session);
  if (!commit({ ...state.value, books: state.value.books.map(b => b.id === book.id ? next : b) })) return false;
  activeId.value = book.id; showSession(studySession(next, session.mode)); return true;
}
function startStudy(book) { if (saveSession(book, studySession(book))) navigate('study'); }
function openManager(book) { stopPlayback(); activeId.value = book.id; managerOpen.value = true; }
function saveManagedBook(book) {
  if (!commit({ ...state.value, books: state.value.books.map(b => b.id === book.id ? book : b) }, { checkpoint: true })) return false;
  undo.value = null;
  if (page.value === 'study') showSession(studySession(book, order.value));
  return true;
}
function jumpTo(entry) {
  let book = currentBook.value;
  if (entry.status === 'hidden') {
    book = reconcileStudy({ ...book, entries: book.entries.map(e => e.id === entry.id ? { ...e, status: 'new' } : e) });
  }
  const session = studySession(book);
  session.cursor = session.queue.indexOf(keyOf(entry.word)); session.completed = false;
  if (session.cursor >= 0 && saveSession(book, session)) { managerOpen.value = false; navigate('study'); }
}
function openHidden(book) { activeId.value = book.id; navigate('hidden'); }
function changeOrder(value) { if (value !== order.value) saveSession(currentBook.value, studySession(currentBook.value, value)); }
function step(delta) {
  if (!queue.value.length) return false;
  return saveSession(currentBook.value, stepSession({ mode: order.value, queue: queue.value, cursor: cursor.value, completed: completed.value }, delta));
}
function restartStudy() {
  showModal({ title: t("重新开始本轮"), content: order.value === 'random' ? t("重新打乱生词，从第一个开始。字母顺序进度会保留。") : t("从字母顺序的第一个生词开始。乱序进度会保留。"), success: ({ confirm }) => {
    if (confirm) saveSession(currentBook.value, studySession(currentBook.value, order.value, { restart: true }));
  } });
}
function hideCurrent() {
  stopPlayback();
  const id = currentEntry.value.id, before = studySession(currentBook.value, order.value);
  const savedUndo = { bookId: activeId.value, word: currentEntry.value.word, session: before };
  if (updateBook(b => { b.entries.find(e => e.id === id).status = 'hidden'; return b; })) {
    showSession(studySession(currentBook.value, order.value));
    undo.value = savedUndo;
    if (before.cursor === before.queue.length - 1) saveSession(currentBook.value, { ...studySession(currentBook.value, order.value), completed: true });
  }
}
function undoHide() {
  const value = undo.value;
  if (!value || value.bookId !== activeId.value) return;
  const book = { ...currentBook.value, entries: currentBook.value.entries.map(e => keyOf(e.word) === keyOf(value.word) ? { ...e, status: 'new' } : e) };
  if (saveSession(book, { ...value.session, completed: false })) undo.value = null;
}
function restore(id) { updateBook(b => { b.entries.find(e => e.id === id).status = 'new'; return reopenStudy(b); }); }
function restoreAll() { updateBook(b => { b.entries.forEach(e => e.status = 'new'); return reopenStudy(b); }); }
function stopPlayback() { playing.value = false; voiceRun++; player.stop(); }
async function pronounce(word) {
  stopPlayback();
  try { await player.play(word, state.value.settings); } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
}
async function playCard() {
  player.stop(); const run = ++voiceRun, word = currentEntry.value?.word;
  if (!word || completed.value || page.value !== 'study' || managerOpen.value) { playing.value = false; return; }
  try {
    const valid = () => run === voiceRun && currentEntry.value?.word === word && page.value === 'study' && !managerOpen.value;
    if (!await player.play(word, state.value.settings, valid) || !valid()) return;
    if (playing.value && await player.gap(state.value.settings.interval) && valid()) {
      if (!step(1)) stopPlayback();
    }
  } catch (e) { if (e.name !== 'AbortError') { stopPlayback(); toast(e.message); } }
}
function togglePlayback() { if (playing.value) stopPlayback(); else { playing.value = true; playCard(); } }
function setPlayback(field, value) { stopPlayback(); commit({ ...state.value, settings: { ...state.value.settings, [field]: value } }); }
watch(() => [page.value, currentEntry.value?.word, order.value, completed.value, managerOpen.value, state.value.settings.autoPronounce], () => {
  player.stop(); voiceRun++;
  if (completed.value || page.value !== 'study' || managerOpen.value) { playing.value = false; return; }
  // #ifdef H5
  if (document.hidden) { playing.value = false; return; }
  // #endif
  if (playbackAvailable && (playing.value || state.value.settings.autoPronounce)) playCard();
}, { flush: 'post' });
function flipCard() { if (Date.now() - swipedAt > 400) flipped.value = !flipped.value; }
function touchStart(event) { const t = event.touches?.[0]; swipeStart = event.target?.closest?.('uni-button,button') ? null : t ? { x: t.clientX, y: t.clientY } : null; }
function touchEnd(event) {
  const t = event.changedTouches?.[0];
  if (swipeStart && t) { const dx = t.clientX - swipeStart.x, dy = t.clientY - swipeStart.y; if (Math.abs(dx) >= 70 && Math.abs(dy) < 45) { swipedAt = Date.now(); step(dx < 0 ? 1 : -1); } }
  swipeStart = null;
}
// #ifdef H5
function keydown(event) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || page.value !== 'study' || managerOpen.value || summaryOpen.value || preview.value || showPaste.value || restoreDraft.value || recoveryOpen.value) return;
  if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  if (event.code === 'Space' && !event.target?.closest?.('uni-button,button')) { event.preventDefault(); flipCard(); }
}
function background() { stopPlayback(); }
onMounted(() => { window.addEventListener('keydown', keydown); window.addEventListener('blur', background); document.addEventListener('visibilitychange', background); window.addEventListener('wordbook-background', background); });
onUnmounted(() => { window.removeEventListener('keydown', keydown); window.removeEventListener('blur', background); document.removeEventListener('visibilitychange', background); window.removeEventListener('wordbook-background', background); stopPlayback(); });
// #endif
function restorePoint(point) { try { restoreDraft.value = validateBackup(JSON.parse(point.raw)); recoveryOpen.value = false; } catch (e) { toast(e.message); } }
async function exportPoint(point) { try { await exportFile('wordbook-recovery.json', point.raw); } catch (e) { toast(e.message); } }
function clearPoints() { showModal({ title: t("清理本地恢复点"), content: t("删除这两个恢复点以释放空间？当前单词本保留，请先导出重要备份。"), success: ({ confirm }) => {
  if (confirm) try { clearRecoveryPoints(); points.value = []; } catch (e) { toast(e.message); }
} }); }
// #ifndef APP-PLUS
async function choose() { try { busy.value = true; const value = await pickFile(); if (value) acceptDocument(value); } catch (e) { toast(e.message); } finally { busy.value = false; } }
// #endif
function acceptDocument(value) {
  previewPage.value = 1;
  if (value?.format === 'wordbook-preview' || (value?.sourceKey && value?.entries)) {
    if (typeof value.name !== 'string' || typeof value.sourceKey !== 'string' || !Array.isArray(value.entries) || value.entries.some(e => !e || typeof e.word !== 'string')) throw Error(t("预览文件格式无效"));
    preview.value = { ...value, entries: reviewEntries(value.entries.map(e => ({ word: e.word, meaning: String(e.meaning || ''), phonetic: String(e.phonetic || ''), example: String(e.example || ''), location: e.location || '' }))) };
  } else { stopPlayback(); restoreDraft.value = validateBackup(value); }
}
// #ifdef APP-PLUS
function onAppDocument(value) { try { acceptDocument(value); } catch (e) { toast(e.message); } }
// #endif
function selectPreview(selected) { preview.value.entries.forEach(row => row.selected = selected); }
function commitImport() {
  try {
    const entries = preview.value.entries.filter(e => e.selected);
    const seen = new Set();
    for (const e of entries) { if (!e.word.trim()) throw Error(t("选中词条的单词不能为空")); if (seen.has(keyOf(e.word))) throw Error(t("选中词条仍有重复，请先剔除或修改")); seen.add(keyOf(e.word)); }
    if (commit(importBook(state.value, preview.value.name, preview.value.sourceKey, entries), { checkpoint: true })) { preview.value = null; navigate('library'); toast(t("单词本已保存")); }
  } catch (e) { toast(e.message); }
}
function parsePasted() { try { acceptDocument(JSON.parse(pasteText.value)); showPaste.value = false; pasteText.value = ''; } catch (e) { toast(e.message); } }
function commitRestore(choices) {
  try {
    const next = restoreWithChoices(state.value, restoreDraft.value, choices);
    if (fatal.value) { saveState(next); state.value = next; fatal.value = ''; }
    else if (!commit(next, { checkpoint: true })) return;
    restoreDraft.value = null; navigate('library'); toast(t("备份已恢复"));
  } catch (e) { toast(e.message); }
}
async function scanInput() { try { inputFiles.value = await desktop().listInput(); if (!inputFiles.value.length) toast(t("dist/input 中没有 Excel、CSV 或 PDF 文件")); } catch (e) { toast(e.message); } }
async function readInput(name) { try { busy.value = true; acceptDocument(await readDocument(name, new Uint8Array(await desktop().readInput(name)))); } catch (e) { toast(e.message); } finally { busy.value = false; } }
async function exportAll() { try {
  const saved = await exportFile('wordbook-backup.json', { ...state.value, exportedAt: new Date().toISOString() });
  if (saved !== false) { try { recordExport(); exportedAt.value = lastExport(); } catch { toast(t("导出已完成，但备份时间记录失败")); } }
} catch (e) { toast(e.message); } }
async function exportRaw() { try { await exportFile('wordbook-raw-backup.json', rawState()); } catch (e) { toast(e.message); } }
function manage(book) {
  uni.showActionSheet({ itemList: [t("重命名"), t("复制单词本"), t("导出单词本"), t("查看隐藏词"), t("删除单词本"), t("搜索与编辑词条")], success: async ({ tapIndex }) => {
    if (tapIndex === 0) renameDraft.value = { id: book.id, name: book.name };
    if (tapIndex === 1 && commit(copyBook(state.value, book.id))) toast(t("已创建独立副本"));
    if (tapIndex === 2) { try { await exportFile(`${book.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.wordbook.json`, { ...state.value, exportedAt: new Date().toISOString(), books: [book] }); } catch (e) { toast(e.message); } }
    if (tapIndex === 3) openHidden(book);
    if (tapIndex === 4) showModal({ title: t("删除单词本"), content: t("确定删除「{0}」及其全部词条？删除前会创建本地恢复点，仍建议先导出备份。", { 0: book.name }), success: ({ confirm }) => { if (confirm) commit({ ...state.value, books: state.value.books.filter(b => b.id !== book.id) }, { checkpoint: true }); } });
    if (tapIndex === 5) openManager(book);
  } });
}
function commitRename() { if (!renameDraft.value.name.trim()) return toast(t("名称不能为空")); if (commit({ ...state.value, books: state.value.books.map(b => b.id === renameDraft.value.id ? { ...b, name: renameDraft.value.name.trim() } : b) })) renameDraft.value = null; }
function addDemo() {
  const entries = [
    ['serendipity', '/ˌserənˈdɪpəti/', 'n. 意外发现美好事物的运气；机缘巧合', 'Finding this little bookshop was pure serendipity.'],
    ['bloom', '/bluːm/', 'v. 开花；蓬勃发展', 'The cherry trees bloom in spring.'],
    ['curiosity', '/ˌkjʊriˈɑːsəti/', 'n. 好奇心；求知欲', 'Curiosity opens the door to learning.'],
    ['wander', '/ˈwɑːndər/', 'v. 漫步；徘徊', 'We wandered through the quiet streets.'],
    ['resilient', '/rɪˈzɪliənt/', 'adj. 有韧性的；能恢复的', 'Small steps help us become more resilient.'],
    ['embrace', '/ɪmˈbreɪs/', 'v. 拥抱；欣然接受', 'Embrace every opportunity to learn.']
  ].map(([word, phonetic, meaning, example]) => ({ word, phonetic, meaning, example }));
  commit(importBook(state.value, '日常拾光 · 示例', 'demo:daily', entries));
}
</script>
