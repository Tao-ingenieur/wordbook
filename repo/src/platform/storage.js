import { emptyState, validateBackup } from '../core/model.mjs';
const KEY = 'wordbook.v1';
const RECOVERY = 'wordbook.recovery.v1', EXPORTED = 'wordbook.exportedAt';
export function recoveryPoints() { try { const values = JSON.parse(uni.getStorageSync(RECOVERY) || '[]'); return Array.isArray(values) ? values.filter(p => typeof p?.raw === 'string' && Number.isFinite(Date.parse(p.at))).slice(0, 2) : []; } catch { return []; } }
export function clearRecoveryPoints() { uni.removeStorageSync(RECOVERY); }
export function lastExport() { return uni.getStorageSync(EXPORTED) || ''; }
export function recordExport() { uni.setStorageSync(EXPORTED, new Date().toISOString()); }
export function loadState() {
  const raw = uni.getStorageSync(KEY);
  if (!raw) return emptyState();
  try { return validateBackup(typeof raw === 'string' ? JSON.parse(raw) : raw); }
  catch { throw Error('本地数据无法读取。请先导出原始数据备份，再通过备份文件恢复；当前不会覆盖原数据。'); }
}
export function saveState(state, { checkpoint = false } = {}) {
  const raw = uni.getStorageSync(KEY);
  let warning = '';
  if (raw) {
    const points = recoveryPoints();
    if (checkpoint || !points.length || Date.now() - Date.parse(points[0].at) >= 86400000) {
      const point = { at: new Date().toISOString(), reason: checkpoint ? '修改前' : '每日', raw: typeof raw === 'string' ? raw : JSON.stringify(raw) };
      try { uni.setStorageSync(RECOVERY, JSON.stringify([point, ...points].slice(0, 2))); }
      catch {
        let kept = false;
        if (points.length) try { uni.setStorageSync(RECOVERY, JSON.stringify([point])); kept = true; } catch { /* Keep the existing recovery data on write failure. */ }
        if (!kept) {
          if (checkpoint) throw Error('无法创建修改前恢复点，请先导出备份并释放存储空间');
          warning = '自动恢复点保存失败，请手动导出备份';
        }
      }
    }
  }
  uni.setStorageSync(KEY, JSON.stringify(state));
  return warning;
}
export function rawState() { return uni.getStorageSync(KEY); }
