/**
 * ui.js — Helper DOM kecil (querySelector, toast, escape, dll).
 */

const UI = {
  qs(sel, root = document) {
    return root.querySelector(sel);
  },

  qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  },

  /**
   * Tampilkan toast notifikasi (style Nintendo 2001 chrome).
   */
  toast(message, opts = {}) {
    const { variant = 'default', duration = 2400 } = opts;
    const el = document.createElement('div');
    el.className = `n-toast ${variant === 'error' ? 'n-toast--error' : ''}`.trim();
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s';
      setTimeout(() => el.remove(), 200);
    }, duration);
  },

  formatSeconds(s) {
    return Math.max(0, s).toFixed(1);
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};
