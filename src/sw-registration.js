(function () {
  var btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  var threshold = 480;
  function toggle() {
    if (window.scrollY > threshold) btn.classList.add('show');
    else btn.classList.remove('show');
  }
  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  toggle();
})();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    console.log('[PWA] Service worker registrado:', reg.scope);
  }).catch(function() {
    console.log('[PWA] Service worker indisponível (file:// ou sem suporte)');
  });
  window.addEventListener('online', function() {
    var t = document.getElementById('saveToast');
    if (t) { t.textContent = 'Conexão restaurada'; t.classList.add('show'); setTimeout(function() { t.classList.remove('show'); }, 2000); }
  });
  window.addEventListener('offline', function() {
    var t = document.getElementById('saveToast');
    if (t) { t.textContent = 'Modo offline — dados locais'; t.classList.add('show'); setTimeout(function() { t.classList.remove('show'); }, 3000); }
  });
}

