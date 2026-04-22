/**
 * PWA registration and network status notifications.
 */
(function initPwaRuntime() {
  if (!('serviceWorker' in navigator)) return;

  const canRegisterSw = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const hadServiceWorkerControllerAtBoot = Boolean(navigator.serviceWorker.controller);
  let isReloadingForUpdate = false;
  let toastTimerId = null;

  function showSystemToast(message, duration) {
    const toast = document.getElementById('saveToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'save-toast';
    toast.classList.add('show');
    clearTimeout(toastTimerId);
    if (duration > 0) {
      toastTimerId = setTimeout(() => {
        toast.classList.remove('show');
        toastTimerId = setTimeout(() => { toast.className = 'save-toast'; }, 220);
      }, duration);
    }
  }

  if (canRegisterSw) {
    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl.href).then((reg) => {
      console.log('[PWA] Service worker registrado:', reg.scope);

      reg.addEventListener('updatefound', () => {
        const nextWorker = reg.installing;
        if (!nextWorker) return;
        nextWorker.addEventListener('statechange', () => {
          if (nextWorker.state === 'installed' && hadServiceWorkerControllerAtBoot) {
            showSystemToast('Nova versao detectada. Aplicando atualizacao...', 2600);
          }
        });
      });

      window.addEventListener('online', () => {
        reg.update().catch(() => {
          console.log('[PWA] Falha ao verificar atualizacao do service worker');
        });
      });
    }).catch(() => {
      console.log('[PWA] Service worker indisponivel (file:// ou sem suporte)');
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadServiceWorkerControllerAtBoot || isReloadingForUpdate) return;
      isReloadingForUpdate = true;
      showSystemToast('Aplicativo atualizado. Recarregando...', 1200);
      setTimeout(() => {
        window.location.reload();
      }, 900);
    });
  } else {
    console.log('[PWA] Service worker indisponivel (file:// ou sem suporte)');
  }

  window.addEventListener('online', () => {
    showSystemToast('Conexão restaurada', 2000);
  });
  window.addEventListener('offline', () => {
    showSystemToast('Modo offline — dados locais', 3000);
  });
})();
