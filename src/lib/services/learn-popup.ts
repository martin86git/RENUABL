/** Remembers, on this device only, when the Learn with Revo pop-up was last closed. */
const KEY = "renuabl.learnPopup.closedAt";

export function learnPopupClosedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function closeLearnPopup() {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable: it may show again next visit */
  }
}
