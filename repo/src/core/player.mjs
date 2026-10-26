// Await actual utterance completion before repeating or advancing; cancel invalidates every pending task.
export function createPlayer({ speak, stopSpeech, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  let generation = 0;
  function stop() { generation++; stopSpeech(); }
  async function play(word, settings, isCurrent = () => true) {
    const token = ++generation;
    for (let i = 0; i < settings.repeat; i++) {
      if (token !== generation || !isCurrent()) return false;
      await speak(word, { rate: settings.rate });
      if (token !== generation || !isCurrent()) return false;
      if (i + 1 < settings.repeat) await wait(settings.interval * 1000);
    }
    return token === generation && isCurrent();
  }
  async function gap(seconds) { const token = generation; await wait(seconds * 1000); return token === generation; }
  return { play, stop, gap };
}
