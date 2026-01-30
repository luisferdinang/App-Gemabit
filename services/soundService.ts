// Optimized Sound Service with Caching
const SOUNDS = {
  COIN: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Coin jingling
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Simple positive chime
  POP: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3', // Pop sound for toggles
  CELEBRATION: 'https://assets.mixkit.co/active_storage/sfx/1992/1992-preview.mp3', // Fanfare/Win
};

// Cache to store Audio objects so we don't recreate them on every click
const audioCache: Record<string, HTMLAudioElement> = {};

const playSound = (url: string, volume: number = 0.5) => {
  try {
    let audio = audioCache[url];
    
    if (!audio) {
      audio = new Audio(url);
      audio.volume = volume;
      audioCache[url] = audio;
    } else {
      // Reset time to allow rapid re-playing (e.g., tapping coins quickly)
      audio.currentTime = 0;
    }

    // Clone node for overlapping sounds if needed (optional optimization for rapid fire)
    // For now, simple replay is enough for UI.
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Auto-play was prevented
        console.warn('Audio playback blocked by browser policy');
      });
    }
  } catch (e) {
    console.error("Error playing sound", e);
  }
};

// Preload sounds silently on load
const preloadSounds = () => {
  Object.values(SOUNDS).forEach(url => {
    const audio = new Audio(url);
    audio.load();
    audioCache[url] = audio;
  });
};

// Start preloading immediately
preloadSounds();

export const soundService = {
  playCoin: () => playSound(SOUNDS.COIN, 0.5),
  playSuccess: () => playSound(SOUNDS.SUCCESS, 0.4),
  playPop: () => playSound(SOUNDS.POP, 0.3),
  playCelebration: () => playSound(SOUNDS.CELEBRATION, 0.5)
};