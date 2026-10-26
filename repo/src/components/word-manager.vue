<template>
  <view class="overlay"><view class="modal wide">
    <view class="modal-heading"><view><text class="section-title">{{ t("搜索与编辑词条") }}</text><text class="muted">{{ book.name }} · {{ matches.length }} {{ t("个结果") }}</text></view><button class="icon-btn" :aria-label="t(&quot;关闭词条管理&quot;)" @click="$emit('close')">×</button></view>
    <input class="name-input" v-model="query" :placeholder="t(&quot;搜索单词或释义&quot;)" :aria-label="t(&quot;搜索单词或释义&quot;)" />
    <view class="entry-tools"><view class="segmented"><button v-for="item in statuses" :key="item.value" :class="{ selected: status === item.value }" @click="status = item.value">{{ item.label }}</button></view><button class="primary" @click="edit()">{{ t("新增词条") }}</button></view>
    <view v-if="draft" class="entry-editor">
      <text class="section-title">{{ draft.id ? t("编辑词条") : t("新增词条") }}</text>
      <input class="name-input" v-model="draft.word" :maxlength="-1" :placeholder="t(&quot;单词（必填）&quot;)" :aria-label="t(&quot;编辑单词&quot;)" />
      <input class="name-input" v-model="draft.phonetic" :maxlength="-1" :placeholder="t(&quot;音标&quot;)" :aria-label="t(&quot;编辑音标&quot;)" />
      <textarea class="entry-text" v-model="draft.meaning" :maxlength="-1" :placeholder="t(&quot;释义&quot;)" :aria-label="t(&quot;编辑释义&quot;)" />
      <textarea class="entry-text" v-model="draft.example" :maxlength="-1" :placeholder="t(&quot;例句&quot;)" :aria-label="t(&quot;编辑例句&quot;)" />
      <text v-if="error" class="notice">{{ t(error) }}</text>
      <view class="modal-footer"><button class="secondary" @click="draft = null">{{ t("取消编辑") }}</button><button class="primary" @click="save">{{ t("保存词条") }}</button></view>
    </view>
    <scroll-view v-else scroll-y class="word-results">
      <view v-for="entry in rows" :key="entry.id" class="word-row"><view><text class="hidden-word">{{ entry.word }}</text><text class="muted">{{ entry.meaning || t("暂无释义") }} · {{ entry.status === 'hidden' ? t("已隐藏") : t("生词") }}</text></view><view class="row-actions"><button class="text-btn" @click="$emit('jump', entry)">{{ entry.status === 'hidden' ? t("恢复并跳转") : t("跳转背诵") }}</button><button class="text-btn" @click="edit(entry)">{{ t("编辑") }}</button><button class="text-btn" @click="remove(entry)">{{ t("删除") }}</button></view></view>
      <text v-if="!matches.length" class="subtitle">{{ t("没有匹配词条，可新增或换个关键词。") }}</text>
    </scroll-view>
    <view v-if="!draft" class="preview-pagination"><button class="text-btn" :disabled="page <= 1" @click="page--">{{ t("上一页") }}</button><text class="muted">{{ page }} / {{ pages }} {{ t("页") }}</text><button class="text-btn" :disabled="page >= pages" @click="page++">{{ t("下一页") }}</button></view>
  </view></view>
</template>
<script setup>
import { t, showModal } from '../i18n/index.js';

import { ref, computed, watch } from 'vue';
import { searchEntries, editEntry, deleteEntry } from '../core/book-tools.mjs';
const props = defineProps({ book: { type: Object, required: true }, saveBook: { type: Function, required: true } });
defineEmits(['close', 'jump']);
const query = ref(''), status = ref('all'), page = ref(1), draft = ref(null), error = ref('');
const statuses = [{ value: 'all', label: t("全部") }, { value: 'new', label: t("生词") }, { value: 'hidden', label: t("隐藏词") }];
const matches = computed(() => searchEntries(props.book, query.value, status.value));
const pages = computed(() => Math.max(1, Math.ceil(matches.value.length / 25)));
const rows = computed(() => matches.value.slice((page.value - 1) * 25, page.value * 25));
watch([query, status], () => { page.value = 1; });
watch(pages, value => { page.value = Math.min(page.value, value); });
function edit(entry) { error.value = ''; draft.value = entry ? { ...entry } : { word: '', phonetic: '', meaning: '', example: '' }; }
function save() { try { if (props.saveBook(editEntry(props.book, draft.value.id, draft.value))) draft.value = null; } catch (e) { error.value = e.message; } }
function remove(entry) { showModal({ title: t("删除词条"), content: t("删除「{0}」？修改前会保留本地恢复点。", { 0: entry.word }), success: ({ confirm }) => {
  if (confirm) try { props.saveBook(deleteEntry(props.book, entry.id)); } catch (e) { uni.showToast({ title: t(e.message), icon: 'none' }); }
} }); }
</script>
<style scoped>
.entry-tools,.row-actions { display:flex; gap:14px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.word-results { height:48vh; margin-top:16px; }.word-row { display:flex; justify-content:space-between; gap:12px; padding:16px 0; border-bottom:1px solid var(--border); }.word-row>view:first-child { display:flex; flex-direction:column; gap:8px; min-width:0; word-break:break-word; }.row-actions { flex-shrink:0; justify-content:flex-end; }
.entry-editor { margin-top:20px; }.entry-editor .name-input { width:100%; }.entry-text { width:100%; height:86px; padding:12px; margin:10px 0; border:1px solid var(--border); border-radius:8px; color:var(--text); background:var(--bg); }
@media(max-width:700px) { .word-row { flex-direction:column; }.row-actions { justify-content:flex-start; } }
</style>
