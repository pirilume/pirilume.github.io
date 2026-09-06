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
  // Narração natural (MP3) do livro gratuito é opcional: se cues.json não existir (caso normal
  // hoje), a busca falha em silêncio e o leitor segue com a voz do aparelho, sem atraso nem erro.
  const isAbsoluteAudioSrc = src => /^[a-z][a-z0-9+.-]*:\/\//i.test(src) || src.startsWith('/');
  fetch('assets/audio/luzes/cues.json').then(response => response.ok ? response.json() : null).then(cues => {
    if (!cues || !Array.isArray(cues.scenes)) return;
    const prefix = 'assets/audio/luzes/';
    free.audio = {
      ...cues,
      scenes: cues.scenes.map(scene => {
        const resolve = src => src ? (isAbsoluteAudioSrc(src) ? src : prefix + src) : null;
        const answer = scene.answer && !Array.isArray(scene.answer) ? { ...scene.answer, src: resolve(scene.answer.src) } : scene.answer;
        return { ...scene, src: resolve(scene.src), answer };
      })
    };
    window.dispatchEvent(new CustomEvent('pirilume-audio-ready',{detail:free}));
  }).catch(() => {});
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
    const state=document.createElement('small');
    state.textContent=book.chapters?.length ? '8 cenas · leitura e voz do aparelho · revisão' : 'Na coleção · lançamento em preparação';
    card.append(friend,title,summary,state);
    if(book.chapters?.length){
      const link=document.createElement('a'); link.href='#livro/'+book.id; link.className='button secondary'; link.textContent='Abrir este livro'; card.append(link);
    }
    grid.append(card);
  });
  select?.addEventListener('change',()=>{location.hash='#livro/'+select.value});
})();
