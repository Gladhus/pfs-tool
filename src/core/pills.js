export function attachPeriodPills(containerId, renderFn) {
  const btns = document.querySelectorAll(`#${containerId} .period-btn`);
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFn();
  }));
}

export function getActivePeriod(containerId) {
  return document.querySelector(`#${containerId} .period-btn.active`)?.dataset.period || 'all';
}
