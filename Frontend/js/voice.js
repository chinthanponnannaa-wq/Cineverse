// Frontend/js/voice.js — Tap-to-Toggle Speech Recognition Engine

import { showToast } from './utils.js';
import { apiVoiceCommand } from './api.js';
import { getMovies, renderMoviesCatalog, setActiveGenre } from './movies.js';
import { openMovieDetailsPage } from './search.js';

let isListening = false;
let speechRecognizer = null;

export function initVoiceRecognition(navigateFn, onUpdateCounts) {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    return;
  }

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  speechRecognizer = new SpeechRec();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onstart = function() {
    isListening = true;
    setListeningState(true);
    showToast("Listening... Tap mic again to finish or cancel.");
  };

  speechRecognizer.onresult = function(event) {
    isListening = false;
    setListeningState(false);
    const transcriptText = event.results[0][0].transcript;
    showToast(`Recognized: "${transcriptText}"`);
    processVoiceCommand(transcriptText, navigateFn, onUpdateCounts);
  };

  speechRecognizer.onerror = function(event) {
    isListening = false;
    setListeningState(false);
    console.warn("Speech recognition notice:", event.error);
    if (event.error === 'not-allowed') {
      showToast("Microphone permission is required for voice search.");
    } else if (event.error === 'no-speech') {
      showToast("No voice command detected.");
    } else if (event.error === 'aborted') {
      showToast("Voice search stopped cleanly.");
    } else {
      showToast("Voice search stopped.");
    }
  };

  speechRecognizer.onend = function() {
    isListening = false;
    setListeningState(false);
  };
}

export function toggleVoiceRecognition() {
  if (!speechRecognizer) {
    showToast("Voice search is not supported in this browser.");
    return;
  }
  if (isListening) {
    try {
      speechRecognizer.stop();
    } catch (e) { console.warn("Stop error:", e); }
    isListening = false;
    setListeningState(false);
    showToast("Voice search stopped.");
  } else {
    try {
      speechRecognizer.start();
    } catch (e) {
      console.warn("Start error:", e);
    }
  }
}

export function setListeningState(on) {
  const wave = document.getElementById('waveAnim');
  const listening = document.getElementById('listeningLabel');
  const idle = document.getElementById('idleLabel');

  if (listening) listening.classList.toggle('hidden', !on);
  if (idle) idle.classList.toggle('hidden', on);
  if (wave) {
    wave.classList.toggle('opacity-30', !on);
    wave.classList.toggle('opacity-100', on);
  }
}

export async function processVoiceCommand(transcriptText, navigateFn, onUpdateCounts) {
  if (!transcriptText) return;
  const lower = transcriptText.toLowerCase();

  if (lower.includes("cart")) {
    showToast("Opening Cart...");
    if (navigateFn) navigateFn('cart');
    return;
  } else if (lower.includes("library")) {
    showToast("Opening Library...");
    if (navigateFn) navigateFn('library');
    return;
  } else if (lower.includes("profile")) {
    showToast("Opening Profile...");
    if (navigateFn) navigateFn('profile');
    return;
  } else if (lower.includes("logout") || lower.includes("sign out")) {
    document.getElementById('logoutBtn')?.click();
    return;
  } else if (lower.includes("action")) {
    setActiveGenre("Action");
    renderMoviesCatalog(onUpdateCounts);
    if (navigateFn) navigateFn('home');
    showToast("Filtered by Action movies");
    return;
  } else if (lower.includes("sci-fi") || lower.includes("science fiction")) {
    setActiveGenre("Sci-Fi");
    renderMoviesCatalog(onUpdateCounts);
    if (navigateFn) navigateFn('home');
    showToast("Filtered by Sci-Fi movies");
    return;
  }

  const movies = getMovies();
  const match = movies.find(m => m.title.toLowerCase().includes(lower) || lower.includes(m.title.toLowerCase()));
  if (match) {
    showToast(`Opening details for ${match.title}...`);
    openMovieDetailsPage(match.id, navigateFn, onUpdateCounts);
    return;
  }

  try {
    showToast('Processing voice command...');
    const data = await apiVoiceCommand(transcriptText);
    if (data && data.aiResponse) {
      const cmd = data.aiResponse;
      if (cmd.response) showToast(cmd.response);

      if (cmd.command === 'FILTER' && cmd.category) {
        setActiveGenre(cmd.category);
        renderMoviesCatalog(onUpdateCounts);
        if (navigateFn) navigateFn('home');
      } else if (cmd.command === 'NAVIGATE' && cmd.page) {
        if (navigateFn) navigateFn(cmd.page);
      } else if (cmd.command === 'LOGOUT') {
        document.getElementById('logoutBtn')?.click();
      }
    }
  } catch (err) {
    showToast('Voice command executed');
  }
}
