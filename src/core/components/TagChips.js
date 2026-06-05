import { escapeHtml } from '../dom.js';

export function renderTagChips(container, tags, onRemove) {
  container.innerHTML = '';
  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)}<button type="button" aria-label="Remove">&times;</button>`;
    chip.querySelector('button').addEventListener('click', () => onRemove(tag));
    container.appendChild(chip);
  }
}
