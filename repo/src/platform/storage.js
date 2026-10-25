import { emptyState, validateBackup } from '../core/model.mjs';
const KEY = 'wordbook.v1';
export function loadState() {
  const raw = uni.getStorageSync(KEY);
  if (!raw) return emptyState();
  try { return validateBackup(typeof raw === 'string' ? JSON.parse(raw) : raw); }
  catch { throw Error('本地数据无法读取。请先导出原始数据备份，再通过备份文件恢复；当前不会覆盖原数据。'); }
}
export function saveState(state) { uni.setStorageSync(KEY, JSON.stringify(state)); }
export function rawState() { return uni.getStorageSync(KEY); }
