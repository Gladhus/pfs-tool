export function attachAutocomplete(input, { getOptions, onPick }) {
  let dropdown = null;
  let activeIdx = -1;

  function show(options) {
    close();
    if (!options.length) return;
    dropdown = document.createElement('ul');
    dropdown.className = 'autocomplete-list';
    options.forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.textContent = opt;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(opt);
      });
      dropdown.appendChild(li);
    });
    const wrap = input.closest('.tag-input-wrap') || input.parentElement;
    wrap.appendChild(dropdown);
    activeIdx = -1;
  }

  function close() {
    dropdown?.remove();
    dropdown = null;
    activeIdx = -1;
  }

  function pick(opt) {
    onPick(opt);
    input.value = '';
    close();
    input.focus();
  }

  function updateActive() {
    if (!dropdown) return;
    dropdown.querySelectorAll('.autocomplete-item').forEach((li, i) =>
      li.classList.toggle('active', i === activeIdx));
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    const all = getOptions();
    const filtered = q ? all.filter(o => o.toLowerCase().includes(q)) : all;
    if (filtered.length) show(filtered); else close();
  }

  input.addEventListener('input', filter);
  input.addEventListener('focus', filter);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', (e) => {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      updateActive();
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      pick(items[activeIdx].textContent);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  return { close };
}
