import test from 'node:test';
import assert from 'node:assert/strict';
import { speak, stopSpeech } from '../src/platform/speech.js';

test('浏览器发音等待 onend，取消旧音不会破坏新音的回调', async () => {
  const previous = { window: globalThis.window, speechSynthesis: globalThis.speechSynthesis, Utterance: globalThis.SpeechSynthesisUtterance };
  const utterances = [];
  globalThis.window = {};
  globalThis.SpeechSynthesisUtterance = class { constructor(word) { this.text = word; } };
  globalThis.speechSynthesis = { speak: u => utterances.push(u), cancel() {} };
  try {
    let finished = false;
    const first = speak('apple', { rate: 0.7 });
    const firstRejected = assert.rejects(first, { name: 'AbortError' });
    const second = speak('bee').then(() => { finished = true; });
    await firstRejected;
    assert.equal(utterances[0].onend, null); assert.equal(utterances[0].rate, 0.7);
    assert.equal(finished, false); utterances[1].onend(); await second; assert.equal(finished, true);
  } finally { stopSpeech(); globalThis.window = previous.window; globalThis.speechSynthesis = previous.speechSynthesis; globalThis.SpeechSynthesisUtterance = previous.Utterance; }
});
test('Android 发音以对应完成事件结束，错误会返回界面而非提前切词', async () => {
  const old = globalThis.window, events = new EventTarget(), calls = [];
  globalThis.window = events;
  events.WordbookAndroid = { speak: (word, rate, id) => calls.push({ word, rate, id }), stopSpeech() {} };
  try {
    const first = speak('apple', { rate: 1.2 }); assert.equal(calls[0].rate, 1.2);
    events.dispatchEvent(new CustomEvent('wordbook-speech-result', { detail: { id: calls[0].id } })); await first;
    const bad = speak('bee'); const rejected = assert.rejects(bad, /缺少语音包/);
    events.dispatchEvent(new CustomEvent('wordbook-speech-result', { detail: { id: calls[1].id, error: '缺少语音包' } })); await rejected;
    const canceled = speak('cat'); const stopped = assert.rejects(canceled, { name: 'AbortError' }); stopSpeech(); await stopped;
  } finally { stopSpeech(); globalThis.window = old; }
});
