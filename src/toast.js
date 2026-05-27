// Tiny toast notification system. Renders bottom-right.
// Use toast(message, { level: 'ok' | 'warn' | '', timeout: ms }).

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');
  document.body.appendChild(container);
  return container;
}

export function toast(message, opts = {}) {
  const level = opts.level || '';
  const timeout = opts.timeout ?? (level === 'warn' ? 6000 : 3000);
  const root = ensureContainer();
  const el = document.createElement('div');
  el.className = 'toast' + (level ? ` toast-${level}` : '');
  el.textContent = message;
  root.appendChild(el);
  // Force a frame so the enter transition runs
  requestAnimationFrame(() => el.classList.add('show'));
  const dismiss = () => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  };
  if (timeout > 0) setTimeout(dismiss, timeout);
  el.addEventListener('click', dismiss);
  return el;
}
