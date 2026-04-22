/**
 * Back-to-top button behavior.
 */
(function initBackToTopButton() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  const threshold = 480;

  function toggle() {
    if (window.scrollY > threshold) btn.classList.add('show');
    else btn.classList.remove('show');
  }

  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  toggle();
})();
