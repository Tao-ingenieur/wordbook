// #ifdef APP-PLUS
let iosSynth;
// #endif
// #ifdef H5
let cancelActive;
function abort() { const error = Error('朗读已取消'); error.name = 'AbortError'; return error; }
// #endif
export function canAutoPlay() {
  // #ifdef H5
  return !!(window.WordbookAndroid || globalThis.speechSynthesis);
  // #endif
  return false;
}
export function stopSpeech() {
  // #ifdef H5
  cancelActive?.(); cancelActive = null;
  window.WordbookAndroid?.stopSpeech?.();
  globalThis.speechSynthesis?.cancel();
  // #endif
}
export function speak(word, { rate = 0.85 } = {}) {
  // #ifdef H5
  stopSpeech();
  if (window.WordbookAndroid) return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random()}`;
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('wordbook-speech-result', done); cancelActive = null; };
    const done = event => { if (event.detail?.id !== id) return; cleanup(); event.detail.error ? reject(Error(event.detail.error)) : resolve(); };
    const timer = setTimeout(() => { cleanup(); window.WordbookAndroid.stopSpeech?.(); reject(Error('系统朗读超时，请检查英文语音包')); }, 45000);
    cancelActive = () => { cleanup(); reject(abort()); };
    window.addEventListener('wordbook-speech-result', done);
    try { window.WordbookAndroid.speak(word, rate, id); } catch (error) { cleanup(); reject(error); }
  });
  if (!globalThis.speechSynthesis) throw Error('此浏览器没有语音朗读能力，请使用系统自带浏览器或桌面版');
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(word); utterance.lang = 'en-US'; utterance.rate = rate;
    const cleanup = () => { clearTimeout(timer); utterance.onend = null; utterance.onerror = null; cancelActive = null; };
    const timer = setTimeout(() => { cleanup(); speechSynthesis.cancel(); reject(Error('系统朗读超时，请检查英文语音包')); }, 45000);
    cancelActive = () => { cleanup(); reject(abort()); };
    utterance.onend = () => { cleanup(); resolve(); };
    utterance.onerror = event => { cleanup(); reject(['interrupted', 'canceled'].includes(event.error) ? abort() : Error('朗读失败，请检查系统英文语音包')); };
    speechSynthesis.speak(utterance);
  });
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    const TTS = plus.android.importClass('android.speech.tts.TextToSpeech');
    const Locale = plus.android.importClass('java.util.Locale');
    let tts;
    const listener = plus.android.implements('android.speech.tts.TextToSpeech$OnInitListener', { onInit: status => {
      if (status !== 0) { uni.showToast({ title: '系统语音初始化失败', icon: 'none' }); return; }
      tts.setLanguage(Locale.US); tts.speak(word, 0, null); setTimeout(() => tts.shutdown(), 15000);
    } });
    tts = new TTS(plus.android.runtimeMainActivity(), listener); return;
  }
  const Synth = plus.ios.importClass('AVSpeechSynthesizer');
  const Utterance = plus.ios.importClass('AVSpeechUtterance');
  const Voice = plus.ios.importClass('AVSpeechSynthesisVoice');
  const nativeUtterance = Utterance.speechUtteranceWithString(word);
  nativeUtterance.setVoice(Voice.voiceWithLanguage('en-US'));
  if (!iosSynth) iosSynth = new Synth();
  iosSynth.stopSpeakingAtBoundary(0); iosSynth.speakUtterance(nativeUtterance); return;
  // #endif
  // #ifdef MP-WEIXIN
  let plugin;
  try { plugin = requirePlugin('WechatSI'); } catch { throw Error('请在微信公众平台为此 AppID 添加同声传译插件，并按 README 配置后重新构建'); }
  plugin.textToSpeech({ lang: 'en_US', tts: true, content: word,
    success: result => {
      const audio = wx.createInnerAudioContext();
      audio.src = result.filename;
      audio.onEnded(() => audio.destroy());
      audio.onError(() => { audio.destroy(); uni.showToast({ title: '发音播放失败，请检查网络', icon: 'none' }); });
      audio.play();
    },
    fail: () => uni.showToast({ title: '语音合成失败，请检查插件授权和网络', icon: 'none' })
  });
  return;
  // #endif
}
