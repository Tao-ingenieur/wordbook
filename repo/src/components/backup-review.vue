<template>
  <view class="overlay"><view class="modal wide">
    <view class="modal-heading"><view><text class="section-title">备份差异与恢复</text><text class="muted">{{ backup.books.length }} 本 · {{ backup.exportedAt ? '导出于 ' + date(backup.exportedAt) : '旧版备份，未记录导出时间' }}</text></view><button class="icon-btn" aria-label="取消备份恢复" @click="$emit('close')">×</button></view>
    <text class="notice">电脑和手机不会自动同步。已有单词本默认保留本机；合并只补入新增词，本机释义、隐藏状态和两套进度优先；覆盖会完整使用备份。确认前会创建本地恢复点；新增/移除数量以选择“覆盖”为准。</text>
    <scroll-view scroll-y class="diff-list"><view v-for="row in diff" :key="row.book.id" class="diff-row">
      <text class="section-title">{{ row.book.name }}</text>
      <text class="subtitle">{{ row.local ? '已有单词本' : '新增单词本' }} · 备份 {{ row.book.entries.length }} 词</text>
      <text v-if="row.local" class="subtitle">本机更新 {{ date(row.local.updatedAt) }} · 备份更新 {{ date(row.book.updatedAt) }}</text>
      <text class="subtitle">新增 {{ row.added }} · 将移除 {{ row.removed }} · 内容变化 {{ row.changed }} · 隐藏状态变化 {{ row.statusChanged }} · {{ row.progressChanged ? '背诵进度不同' : '进度一致或未开始' }}</text>
      <text v-if="row.local" class="muted">本机：{{ position(row.local) }}；备份：{{ position(row.book) }}</text>
      <view class="diff-options"><button class="secondary" :class="{ chosen: choices[row.book.id] === 'keep' }" @click="choices[row.book.id] = 'keep'">{{ row.local ? '保留本机' : '不导入' }}</button><button v-if="row.local" class="secondary" :class="{ chosen: choices[row.book.id] === 'merge' }" @click="choices[row.book.id] = 'merge'">合并新增词</button><button class="secondary" :class="{ chosen: choices[row.book.id] === 'replace' }" @click="choices[row.book.id] = 'replace'">{{ row.local ? '使用备份覆盖' : '导入此本' }}</button></view>
    </view></scroll-view>
    <view class="modal-footer"><button class="secondary" @click="$emit('close')">取消</button><button class="primary" :disabled="!canRestore" @click="$emit('restore', choices)">确认所选恢复方式</button></view>
  </view></view>
</template>
<script setup>
import { computed, ref } from 'vue';
import { backupDiff } from '../core/book-tools.mjs';
const props = defineProps({ current: { type: Object, required: true }, backup: { type: Object, required: true } });
defineEmits(['close', 'restore']);
const diff = computed(() => backupDiff(props.current, props.backup));
const choices = ref(Object.fromEntries(diff.value.map(row => [row.book.id, row.local ? 'keep' : 'replace'])));
const canRestore = computed(() => Object.values(choices.value).some(mode => mode !== 'keep'));
const date = value => value ? value.replace('T', ' ').slice(0, 16) : '未知';
const position = book => ['alpha', 'random'].map(mode => `${mode === 'alpha' ? '字母' : '乱序'} ${book.study?.[mode]?.current || '未开始'}${book.study?.[mode]?.completed ? '（本轮完成）' : ''}`).join(' / ');
</script>
<style scoped>
.diff-list { height:48vh; margin-top:16px; }.diff-row { padding:18px 0; border-bottom:1px solid var(--border); }.diff-options { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }.chosen { border-color:var(--accent); background:var(--soft); color:var(--accent); }
</style>
