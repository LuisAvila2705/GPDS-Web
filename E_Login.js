function toggleBenefit(button) {
  const item = button?.closest('.benefit-item');
  if (!item) return;

  const isExpanded = item.classList.contains('expanded');

  // Cierra todos
  document.querySelectorAll('.benefit-item').forEach(i => {
    i.classList.remove('expanded');
    const btn = i.querySelector('.toggle-btn');
    if (btn) btn.textContent = 'Ver más';
    // Accesibilidad
    i.querySelector('.toggle-btn')?.setAttribute('aria-expanded', 'false');
  });

  // Abre el seleccionado
  if (!isExpanded) {
    item.classList.add('expanded');
    button.textContent = 'Ver menos';
    button.setAttribute('aria-expanded', 'true');
  }
}

// Delegación: escucha clicks en toda la rejilla
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.benefits-grid');
  grid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    toggleBenefit(btn);
  });
});
