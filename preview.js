(() => {
  const audio = document.getElementById('voice-preview-player');
  const button = document.getElementById('preview-toggle');
  const status = document.getElementById('preview-status');
  const error = document.getElementById('voice-preview-error');
  if (!audio || !button) return;
  function sync() {
    button.textContent = audio.paused ? '▶ Ouvir trecho da narração · 27 segundos' : 'Ⅱ Pausar prévia';
    button.setAttribute('aria-pressed', String(!audio.paused));
  }
  button.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    error.hidden = true;
    status.textContent = 'Carregando a prévia…';
    try {
      document.getElementById('stop-button')?.click();
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch {
      status.textContent = '';
      error.hidden = false;
    }
    sync();
  });
  audio.addEventListener('playing', () => { status.textContent = 'Ouvindo a prévia.'; error.hidden = true; sync(); });
  audio.addEventListener('pause', () => { status.textContent = audio.ended ? 'Prévia concluída.' : 'Prévia pausada.'; sync(); });
  audio.addEventListener('ended', () => { status.textContent = 'Prévia concluída. Você pode ouvir novamente.'; sync(); });
  audio.addEventListener('error', () => {status.textContent = ''; error.hidden = false; sync();});
  sync();
})();
