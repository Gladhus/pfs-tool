import { attachAutocomplete } from '../autocomplete.js';

export function attachTagInput(input, { getTags, onAdd, onPop, getAvailableTags }) {
  if (input._tagInputAttached) return;
  input._tagInputAttached = true;

  function commit() {
    const raw = input.value.trim();
    if (!raw) return;
    for (const p of raw.split(',').map(s => s.trim()).filter(Boolean)) {
      if (!getTags().includes(p)) onAdd(p);
    }
    input.value = '';
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !input.value && onPop && getTags().length) {
      onPop();
    }
  });
  input.addEventListener('blur', commit);

  attachAutocomplete(input, {
    getOptions: () => getAvailableTags(),
    onPick: (tag) => {
      if (!getTags().includes(tag)) onAdd(tag);
    },
  });
}
