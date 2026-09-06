(() => {
  const reader = document.getElementById('reader-view');
  const cover = document.getElementById('book-cover');
  const open = document.getElementById('open-book');
  const close = document.getElementById('close-book');
  const fullscreen = document.getElementById('fullscreen-book');
  const fullscreenStatus = document.getElementById('fullscreen-status');
  const supportsFullscreen = Boolean(document.fullscreenEnabled && reader.requestFullscreen);
  function fullscreenLabel() {
    const active = document.fullscreenElement === reader;
    fullscreen.textContent = active ? 'Sair da tela cheia' : 'Tela cheia';
    fullscreen.setAttribute('aria-pressed', String(active));
    fitArt();
  }
  fullscreen.addEventListener('click', async () => {
    fullscreenStatus.textContent = '';
    try {
      if (document.fullscreenElement === reader) await document.exitFullscreen();
      else await reader.requestFullscreen();
    } catch {
      fullscreenStatus.textContent = 'Não foi possível abrir em tela cheia. Você pode continuar no modo de leitura.';
    }
  });
  document.addEventListener('fullscreenchange', fullscreenLabel);
  const spread = document.querySelector('.reader-layout');
  const voice = document.getElementById('voice-select');
  const initialVoice = document.getElementById('initial-voice');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let opening = null, leafAnimation = null, leaf = null;
  let previousIndex = 0, previousPage = null, previousArt = null;
  const art = document.getElementById('reader-art');
  function fitArt() {
    const index = sceneIndex();
    const width = art.clientWidth, height = art.clientHeight;
    if (!width || !height) return;
    const ratio = 1;
    const scale = Math.min(width / ratio, height);
    const imageWidth = scale * ratio, imageHeight = scale;
    const cropX = (imageWidth - width) / 2, cropY = (imageHeight - height) / 2;
    const columns = Number(art.dataset.columns) || 2, rows = Number(art.dataset.rows) || 2;
    const frame = Number(art.dataset.frame) || 0;
    art.style.backgroundSize = `${imageWidth * columns}px ${imageHeight * rows}px`;
    art.style.backgroundPosition = `${-(frame % columns) * imageWidth - cropX}px ${-Math.floor(frame / columns) * imageHeight - cropY}px`;
    const lights = art.querySelector('.scene-lights');
    if (lights) lights.style.cssText = `width:${imageWidth}px;height:${imageHeight}px;left:${-cropX}px;top:${-cropY}px;right:auto;bottom:auto`;
  }
  // Positions measured in each original illustration's quadrant, in percent.
  const stars = [[80,48],[54,64],[57,52],[33,44],[61,55],[50,67],[70,28],[80,22]];
  const fireflies = [[],[],[[4,34],[24,31],[29,42],[24,58],[78,48],[94,41],[94,65]],[],[],[],[[11,14],[24,13],[40,13],[59,16],[63,18],[82,21],[88,27],[84,34],[72,43],[61,42],[55,37],[51,25],[30,29]],[]];
  function sceneIndex() {
    return Math.max(0, Array.from(document.querySelectorAll('#chapter-nav button')).findIndex(b => b.hasAttribute('aria-current')));
  }
  function updateLights(index) {
    art.querySelector('.scene-lights')?.remove();
    const lights = document.createElement('span');
    lights.className = 'scene-lights'; lights.setAttribute('aria-hidden','true');
    const free = !window.PIRILUME_ACTIVE_BOOK || window.PIRILUME_ACTIVE_BOOK.id === 'luzes';
    const points = free ? [stars[index], ...fireflies[index]] : (window.PIRILUME_ACTIVE_BOOK.chapters[index].lights || []);
    points.forEach(([x,y], i) => {
      const point = document.createElement('span');
      point.className = i ? 'firefly-light' : 'lume-light';
      point.style.cssText = `left:${x}%;top:${y}%;--delay:${-i * .57}s;--duration:${3.4 + (i % 4) * .6}s`;
      lights.append(point);
    });
    art.append(lights);
    fitArt();
  }
  function copyPage(element) {
    const copy = element.cloneNode(true);
    [copy,...copy.querySelectorAll('[id]')].forEach(el => el.removeAttribute('id'));
    copy.querySelectorAll('.is-speaking').forEach(el => el.classList.remove('is-speaking'));
    copy.inert = true; copy.setAttribute('aria-hidden','true');
    return copy;
  }
  function clearLeaf() {
    leafAnimation?.cancel(); leafAnimation = null;
    leaf?.remove(); leaf = null;
  }
  const stop = () => document.getElementById('stop-button').click();
  function syncVoices() {
    initialVoice.replaceChildren(...Array.from(voice.options, option => option.cloneNode(true)));
    initialVoice.value = voice.value;
    initialVoice.disabled = voice.disabled;
  }
  new MutationObserver(syncVoices).observe(voice, {childList: true, attributes: true});
  voice.addEventListener('change', syncVoices);
  initialVoice.addEventListener('change', () => {
    voice.value = initialVoice.value;
    voice.dispatchEvent(new Event('change'));
  });
  function setOpen(value) {
    opening?.cancel(); opening = null;
    open.disabled = false;
    clearLeaf();
    stop();
    reader.classList.toggle('book-closed', !value);
    document.body.classList.toggle('reading-focus', value);
    fullscreen.hidden = !value || !supportsFullscreen;
    fullscreenStatus.textContent = '';
    if (!value && document.fullscreenElement === reader) document.exitFullscreen().catch(() => {});
    cover.hidden = value;
    close.hidden = !value;
    if (value) {
      fitArt();
      spread.setAttribute('tabindex', '-1');
      spread.focus({preventScroll: true});
      reader.scrollIntoView({block:'start',behavior:reduced() ? 'auto' : 'smooth'});
    }
  }
  open.addEventListener('click', async () => {
    if (opening) return;
    if (reduced()) { setOpen(true); return; }
    open.disabled = true;
    const face = cover.querySelector('.cover-face');
    const current = face.animate([
      {transform:'perspective(1400px) rotateY(0deg)',filter:'brightness(1)'},
      {transform:'perspective(1400px) rotateY(-105deg)',filter:'brightness(.65)',offset:.7},
      {transform:'perspective(1400px) rotateY(-160deg)',filter:'brightness(.4)'}
    ], {duration:1100,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    opening = current;
    try { await current.finished; } catch { return; }
    if (opening !== current) return;
    setOpen(true);
    spread.animate([{opacity:0,transform:'scale(.95)'},{opacity:1,transform:'scale(1)'}],{duration:350,easing:'ease-out'});
  });
  close.addEventListener('click', () => { setOpen(false); open.focus(); });
  window.addEventListener('hashchange', () => { setOpen(false); syncVoices(); });
  new MutationObserver(() => {
    const index = sceneIndex();
    updateLights(index);
    clearLeaf();
    if (index !== previousIndex && previousPage && !reader.classList.contains('book-closed') && !reduced()) {
      const backwards = index < previousIndex;
      const narrow = matchMedia('(max-width:900px)').matches;
      const target = backwards && !narrow ? document.querySelector('.reader-visual') : document.querySelector('.reader-page');
      const source = backwards && !narrow ? previousArt : previousPage;
      leaf = document.createElement('div');
      leaf.className = 'turning-leaf' + (backwards ? ' backwards' : '');
      leaf.inert = true; leaf.setAttribute('aria-hidden','true');
      leaf.style.cssText = `left:${target.offsetLeft}px;top:${target.offsetTop}px;width:${target.offsetWidth}px;height:${target.offsetHeight}px`;
      const front = document.createElement('div'); front.className = 'leaf-front'; front.append(source.cloneNode(true));
      const back = document.createElement('div'); back.className = 'leaf-back';
      const destination = backwards && !narrow ? document.querySelector('.reader-page') : document.querySelector('.reader-visual');
      back.append(copyPage(destination));
      leaf.append(front,back); spread.append(leaf);
      const thisLeaf = leaf;
      leafAnimation = leaf.animate([
        {transform:'rotateY(0deg)',filter:'brightness(1)',opacity:1},
        {transform:`rotateY(${backwards ? 75 : -75}deg)`,filter:'brightness(.8)',opacity:1,offset:.42},
        {transform:`rotateY(${backwards ? 160 : -160}deg)`,filter:'brightness(.95)',opacity:1,offset:.84},
        {transform:`rotateY(${backwards ? 180 : -180}deg)`,filter:'brightness(1)',opacity:0}
      ], {duration:1300,easing:'cubic-bezier(.25,.1,.25,1)',fill:'forwards'});
      leafAnimation.finished.then(() => { thisLeaf.remove(); if (leaf === thisLeaf) leaf = null; }).catch(() => {});
    }
    previousIndex = index;
    previousPage = copyPage(document.querySelector('.reader-page'));
    previousArt = copyPage(document.querySelector('.reader-visual'));
  }).observe(document.getElementById('chapter-title'), {childList: true});
  previousIndex = sceneIndex(); updateLights(previousIndex);
  previousPage = copyPage(document.querySelector('.reader-page'));
  previousArt = copyPage(document.querySelector('.reader-visual'));
  window.addEventListener('resize', clearLeaf);
  new ResizeObserver(fitArt).observe(art);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearLeaf(); if (opening) setOpen(false); }
  });
  syncVoices();
  setOpen(false);
})();
