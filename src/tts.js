// Playback of pre-rendered narration/cue audio files. The backend (the
// create-journey skill) generates the MP3s; the app just plays them by URL.
//
// playAudio(url) returns a Promise that resolves when the clip finishes (or is
// cancelled) and rejects if it fails to load/play.

let token = 0; // bumped on every play/cancel; stale callbacks check it and bail
let audio = null; // active <audio> element
let settle = null; // resolves the current end-wait when cancelled

export function playAudio(url) {
  cancelAudio();
  const myToken = ++token;

  return (async () => {
    audio = new Audio(url);
    const done = new Promise((resolve, reject) => {
      settle = resolve; // cancelAudio() resolves this
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('audio failed to load: ' + url));
    });
    await audio.play();
    await done;
  })();
}

export function pauseAudio() {
  if (audio && !audio.paused) audio.pause();
}

export function resumeAudio() {
  if (audio && audio.paused) audio.play().catch(() => {});
}

export function cancelAudio() {
  token++;
  if (settle) {
    settle('cancelled');
    settle = null;
  }
  if (audio) {
    audio.pause();
    audio = null;
  }
}
