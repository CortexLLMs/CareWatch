// src/lib/storage.js
// localStorage helpers for the saved medication profile.

const LS_KEY = "carewatch_med";

export const saveLocal = (data) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
};

export const loadLocal = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const clearLocal = () => {
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
};
