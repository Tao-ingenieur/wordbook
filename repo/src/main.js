import { createSSRApp } from 'vue';
import App from './App.vue';
export function createApp() { return { app: createSSRApp(App) }; }
// #ifdef H5
if (import.meta.env.PROD && !window.WordbookAndroid && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('离线缓存未启用', error.message));
}
// #endif
