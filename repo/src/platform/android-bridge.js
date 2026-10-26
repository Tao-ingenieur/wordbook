// H5 is also embedded in our Android shell; ordinary browsers never expose this bridge.
export function saveAndroidBackup(name, text) {
  return new Promise((resolve, reject) => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const done = event => {
      if (event.detail?.id !== id) return;
      window.removeEventListener('wordbook-native-result', done);
      if (event.detail.error) reject(Error(event.detail.error));
      else resolve(event.detail.saved === true);
    };
    window.addEventListener('wordbook-native-result', done);
    try { window.WordbookAndroid.saveFile(name, text, id); }
    catch (error) { window.removeEventListener('wordbook-native-result', done); reject(error); }
  });
}
