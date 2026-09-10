(() => {
  const free = {
    id:'luzes', title:'O bosque das pequenas luzes', subtitle:'Uma aventura de Nino e Lume',
    friend:'Nino & Lume', summary:'Uma estrela perdida, uma raposinha e pequenas ajudas pelo caminho.',
    free:true, language:'pt-BR', chapters:window.PIRILUME_STORY,
    questions:['Quem ajudou Nino, mesmo sem carregar a estrela?','Você lembra de uma vez em que pediu ajuda?','Que pequena ajuda podemos oferecer amanhã?'],
    cover:'assets/scene-sheet-a-expanded.png', columns:2, rows:2
  };
  window.PIRILUME_BOOKS = [free,...(window.PIRILUME_COLLECTION || [])];
  window.PIRILUME_ACTIVE_BOOK = free;
  // Narração natural (MP3) do livro gratuito é opcional e suporta várias vozes: se voices.json
  // existir, cada voz tem seu próprio cues.json numa subpasta; senão tenta o cues.json antigo
  // (uma voz só). Se nenhum existir (caso normal hoje), a busca falha em silêncio e o leitor
  // segue com a voz do aparelho, sem atraso nem erro na renderização.
  const isAbsoluteAudioSrc = src => /^[a-z][a-z0-9+.-]*:\/\//i.test(src) || src.startsWith('/');
  const audioBase = 'assets/audio/luzes/';
  const loadAudioJson = path => fetch(audioBase + path).then(response => response.ok ? response.json() : null).catch(() => null);
  const buildScenes = (cues, prefix) => {
    const resolve = src => src ? (isAbsoluteAudioSrc(src) ? src : prefix + src) : null;
    return cues.scenes.map(scene => {
      const answer = scene.answer && !Array.isArray(scene.answer) ? { ...scene.answer, src: resolve(scene.answer.src) } : scene.answer;
      return { ...scene, src: resolve(scene.src), answer };
    });
  };
  (async () => {
    let voices = null, defaultId = null;
    const manifest = await loadAudioJson('voices.json');
    if (manifest && Array.isArray(manifest.voices) && manifest.voices.length) {
      const built = [];
      for (const v of manifest.voices) {
        if (!v || typeof v.id !== 'string' || typeof v.cues !== 'string') continue;
        const cues = await loadAudioJson(v.cues);
        if (!cues || !Array.isArray(cues.scenes)) continue;
        const folder = v.cues.includes('/') ? v.cues.slice(0, v.cues.lastIndexOf('/') + 1) : '';
        built.push({ id: v.id, label: v.label || v.id, voice: v.voice, scenes: buildScenes(cues, audioBase + folder) });
      }
      if (built.length) { voices = built; defaultId = manifest.default; }
    }
    if (!voices) {
      const legacy = await loadAudioJson('cues.json');
      if (legacy && Array.isArray(legacy.scenes)) { voices = [{ id: 'natural', label: 'voz natural', voice: legacy.voice, scenes: buildScenes(legacy, audioBase) }]; defaultId = 'natural'; }
    }
    if (!voices) return;
    if (!voices.some(v => v.id === defaultId)) defaultId = voices[0].id;
    const defaultVoice = voices.find(v => v.id === defaultId);
    free.audio = { default: defaultVoice.id, voices, scenes: defaultVoice.scenes };
    window.dispatchEvent(new CustomEvent('pirilume-audio-ready',{detail:free}));
  })().catch(() => {});
  const select = document.getElementById('book-picker');
  const grid = document.getElementById('collection-books');
  window.PIRILUME_BOOKS.forEach(book => {
    if (book.chapters?.length && select) {
      const option = document.createElement('option');
      option.value=book.id; option.textContent=book.title;
      select.append(option);
    }
    if (book.free || !grid) return;
    const card=document.createElement('article'); card.className='collection-card';
    const art=document.createElement('div'); art.className='collection-cover'; art.setAttribute('role','img');
    art.setAttribute('aria-label',book.coverAlt || book.subtitle);
    art.style.backgroundImage=`url('${book.cover}')`;
    art.style.backgroundSize=`${book.columns*100}% ${book.rows*100}%`;
    const friend=document.createElement('p'); friend.className='eyebrow'; friend.textContent=book.friend;
    const title=document.createElement('h3'); title.textContent=book.title;
    const summary=document.createElement('p'); summary.textContent=book.summary;
    const state=document.createElement('small'); state.className='card-state';
    state.textContent='8 cenas · narração gravada';
    card.append(friend,title,summary,state);
    // Só aparece em modo leitor (CSS): faz o mesmo que o botão do livro no painel #biblioteca,
    // buscando o livro e abrindo, mesmo se ainda não tiver sido carregado.
    const openButton=document.createElement('button'); openButton.type='button'; openButton.className='button secondary card-open-book'; openButton.textContent='Abrir este livro';
    openButton.onclick=()=>window.PIRILUME_OPEN_BOOK?.(book);
    card.append(openButton);
    if(book.chapters?.length){
      const link=document.createElement('a'); link.href='#livro/'+book.id; link.className='button secondary'; link.textContent='Abrir este livro'; card.append(link);
    }
    grid.append(card);
  });
  select?.addEventListener('change',()=>{location.hash='#livro/'+select.value});
})();
