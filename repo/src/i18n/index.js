import { ref } from 'vue';
import { translate } from './messages.mjs';

const KEY = 'wordbook.locale';
function savedLocale() {
  try { return typeof uni !== 'undefined' && uni.getStorageSync(KEY) === 'en' ? 'en' : 'zh'; }
  catch { return 'zh'; }
}
export const locale = ref(savedLocale());
export const t = (message, params) => translate(message, locale.value, params);
export function setLocale(value) {
  if (!['zh', 'en'].includes(value)) throw Error('Unsupported language');
  // Save first: a storage failure must not silently lose the language preference.
  uni.setStorageSync(KEY, value);
  locale.value = value;
  uni.setLocale?.(value === 'en' ? 'en' : 'zh-Hans');
}
export function showModal(options) {
  return uni.showModal({ confirmText: t('确定'), cancelText: t('取消'), ...options });
}
export function locationText(value) {
  const text = String(value || '');
  if (locale.value !== 'en') return text;
  return text.replace(/第\s*(\d+)\s*行/g, 'Row $1').replace(/第\s*(\d+)\s*页/g, 'Page $1');
}
export const warningText = value => String(value || '').split('；').map(part => t(part)).join(locale.value === 'en' ? '; ' : '；');
