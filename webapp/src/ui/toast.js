let toastTimer = null;

export function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  const bg = { ok: 'bg-zinc-900 text-white', error: 'bg-red-600 text-white', warn: 'bg-amber-500 text-white' };
  el.className = `fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${bg[type] || bg.ok}`;
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
  }, 3500);
}
