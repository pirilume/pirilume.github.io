(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // Pontua vozes pt-BR/pt-PT do aparelho para a escolha "Automática" preferir a melhor
  // voz disponível (neural/online) em vez de deixar o navegador cair numa voz robótica antiga.
  function rankVoice(voice) {
    if (!voice) return -1;
    const lang = String(voice.lang || '').replace('_', '-');
    const name = String(voice.name || '');
    const isPtPT = /^pt-PT/i.test(lang);
    let score;
    if (isPtPT) score = 10;
    else if (/natural/i.test(name)) score = 100;
    else if (/google/i.test(name)) score = 80;
    else if (/premium|enhanced/i.test(name)) score = 75;
    else if (/francisca|thalita|ant[oô]nio|luciana|fernanda/i.test(name)) score = 70;
    else score = 40;
    if (voice.default) score += 1;
    if (voice.localService === false) score += 2;
    return score;
  }
  // Nome curto pra status de leitura: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)" -> "Francisca (Natural)".
  function shortVoiceName(name) {
    if (!name) return '';
    return String(name)
      .replace(/Microsoft\s+/gi, '')
      .replace(/\bOnline\b/gi, '')
      .replace(/-?\s*Portuguese\s*\(Brazil\)/gi, '')
      .replace(/-?\s*Portuguese\s*\(Portugal\)/gi, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  window.PIRILUME_RANK_VOICE = rankVoice;
  window.PIRILUME_SHORT_VOICE_NAME = shortVoiceName;
  let toastTimer;
  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 4500);
  }
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const source = $(button.dataset.copy);
      if (!source) return;
      try {
        if (!navigator.clipboard) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(source.innerText);
        toast('Texto copiado. Revise os links e as condições antes de publicar.');
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(source); selection.removeAllRanges(); selection.addRange(range);
        toast('Selecione Copiar no menu do aparelho. O texto está selecionado.');
      }
    });
  });
  if ($('calc-price')) {
    const ids = ['price','percent','fixed','tax','loss','support','cac','production'];
    const money = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    function recalculate() {
      const values = {};
      let invalid = false;
      ids.forEach(key => {
        const input = $('calc-' + key);
        const value = Number(input.value);
        if (input.value === '' || !Number.isFinite(value) || !input.checkValidity()) invalid = true;
        values[key] = value;
      });
      if (invalid) {
        $('calc-ceiling').textContent = 'Revise os valores';
        $('calc-margin').textContent = 'Não calculado';
        $('calc-break-even').textContent = 'Não calculado';
        $('calc-warning').textContent = 'Use valores não negativos e percentuais entre 0 e 100.';
        return;
      }
      const ceiling = values.price * (1 - (values.percent + values.tax + values.loss)/100) - values.fixed - values.support;
      const margin = ceiling - values.cac;
      $('calc-ceiling').textContent = money(ceiling);
      $('calc-margin').textContent = money(margin);
      $('calc-break-even').textContent = margin > 0 ? Math.ceil(values.production / margin).toLocaleString('pt-BR') : 'Não se recupera';
      $('calc-warning').textContent = margin <= 0 ? 'Com essas premissas, cada venda não contribui para recuperar a produção. Reveja preço, custos ou aquisição.' : 'Sobra por venda antes de despesas fixas e de diferenças entre reservas e custos reais. Não é lucro líquido.';
    }
    ids.forEach(id => $('calc-' + id).addEventListener('input', recalculate));
    recalculate();
  }
  if (!$('home-view')) return;
  let activeBook = window.PIRILUME_BOOKS?.[0];
  let story = window.PIRILUME_STORY;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const audioPreview = $('voice-preview-player');
  if (audioPreview) audioPreview.addEventListener('error', () => { $('voice-preview-error').hidden = false; });
  let scene = 0, limit = 8, sample = false, run = 0, speaking = false, paused = false, voices = [];
  let utteranceRef = null;
  let awaitingInteraction = false, nextNarrationTimer = null;
  // Camada opcional de narração natural (MP3 gravado). `engine` diz qual motor está tocando
  // o parágrafo atual, para pausar/parar/continuar acertarem no alvo certo.
  let engine = 'synth', player = null, playerCleanup = null;
  function getPlayer() {
    if (!player) {
      player = document.createElement('audio');
      player.preload = 'auto';
      player.hidden = true;
      document.body.appendChild(player);
    }
    return player;
  }
  function naturalSelected() {
    return Boolean(activeBook?.audio) && $('voice-select').value === 'natural';
  }
  // Toca um trecho {src,start,end} do player reaproveitado. onStart/onEnd espelham o
  // tratamento que a utterance já tem hoje (destaque + status); onFail cai para a voz do aparelho.
  function playNaturalSegment(segment, handlers, token) {
    const el = getPlayer();
    const start = segment.start || 0, end = segment.end;
    function cleanup() {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onErr);
      if (playerCleanup === cleanup) playerCleanup = null;
    }
    function onTime() {
      if (token !== run) { cleanup(); return; }
      if (end != null && el.currentTime >= end - 0.05) { cleanup(); el.pause(); handlers.onEnd(); }
    }
    function onEnded() {
      cleanup();
      if (token !== run) return;
      handlers.onEnd();
    }
    function onErr() {
      cleanup(); el.pause();
      if (token !== run) return;
      handlers.onFail();
    }
    function begin() {
      if (token !== run) { cleanup(); return; }
      try { el.currentTime = start; } catch { /* metadata ainda carregando; segue mesmo assim */ }
      handlers.onStart();
      const playing = el.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => { cleanup(); handlers.onFail(); });
    }
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onErr);
    playerCleanup = cleanup;
    let resolvedTarget;
    try { resolvedTarget = new URL(segment.src, location.href).href; } catch { resolvedTarget = segment.src; }
    if (el.currentSrc !== resolvedTarget) {
      // iOS/Safari só libera áudio se play() for chamado ainda dentro do toque do usuário:
      // troca o arquivo, chama play() já, e posiciona no início do trecho quando os metadados chegarem.
      el.addEventListener('loadedmetadata', () => {
        if (token !== run) { cleanup(); el.pause(); return; }
        try { el.currentTime = start; } catch { /* segue do começo */ }
      }, { once: true });
      el.src = segment.src;
      el.load();
      handlers.onStart();
      const playing = el.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => { cleanup(); el.pause(); if (token === run) handlers.onFail(); });
    } else begin();
  }
  function speechUI() {
    $('speak-button').textContent = speaking ? (paused ? '▷ Continuar' : 'Ⅱ Pausar') : '▷ Ouvir cena';
    $('stop-button').disabled = !speaking;
  }
  function stopSpeech(clearStatus = true) {
    clearTimeout(nextNarrationTimer); nextNarrationTimer = null;
    awaitingInteraction = false;
    $('interaction-cue').hidden = true;
    $('discovery-button').setAttribute('data-awaiting', 'false');
    $('discovery-button').disabled = false;
    run++; speaking = false; paused = false;
    if (synth) synth.cancel();
    utteranceRef = null;
    if (playerCleanup) { playerCleanup(); playerCleanup = null; }
    if (player && !player.paused) player.pause();
    engine = 'synth';
    document.querySelectorAll('#story-text p').forEach(p => p.classList.remove('is-speaking'));
    speechUI();
    if (clearStatus) {
      if (activeBook?.audio) $('voice-status').textContent = 'Narração Pirilume disponível. Vozes do aparelho continuam como alternativa.';
      else $('voice-status').textContent = synth ? 'Voz de teste do dispositivo. O timbre e a disponibilidade variam conforme o navegador.' : 'Este navegador não oferece narração. Você pode ler a história em voz alta.';
    }
  }
  function renderScene(index, focus = false) {
    stopSpeech();
    scene = Math.max(0, Math.min(index, limit - 1));
    const chapter = story[scene];
    $('reader-art').className = chapter.image ? 'scene-art' : 'scene-art art-' + chapter.sheet + ' quadrant-' + chapter.quadrant;
    const image = chapter.image || (chapter.sheet === 'b' ? 'assets/scene-sheet-b-expanded.png' : 'assets/scene-sheet-a-expanded.png');
    $('reader-art').style.backgroundImage = `url('${image}')`;
    $('reader-art').dataset.columns = chapter.columns || 2;
    $('reader-art').dataset.rows = chapter.rows || 2;
    $('reader-art').dataset.frame = chapter.frame ?? chapter.quadrant;
    $('reader-art').setAttribute('aria-label', chapter.alt);
    $('chapter-kicker').textContent = chapter.kicker;
    $('chapter-title').textContent = chapter.title;
    $('scene-counter').textContent = 'CENA ' + (scene + 1) + ' DE ' + limit + (sample ? ' · AMOSTRA' : '');
    $('story-text').replaceChildren(...chapter.paragraphs.map((text, i) => {
      const p = document.createElement('p'); p.textContent = text; p.dataset.paragraph = i; return p;
    }));
    $('reader-page').scrollTop = 0;
    $('discovery-button').textContent = chapter.action;
    $('discovery-button').setAttribute('aria-expanded','false');
    $('discovery-answer').textContent = chapter.answer;
    $('discovery-answer').hidden = true;
    $('prev-button').disabled = scene === 0;
    $('next-button').disabled = false;
    $('next-button').textContent = scene === limit - 1 ? (sample ? 'Concluir amostra →' : 'Conversar sobre a história →') : 'Próxima →';
    $('reader-end').hidden = true; $('sample-end').hidden = true;
    $('chapter-nav').replaceChildren(...story.slice(0,limit).map((chapter, i) => {
      const button = document.createElement('button');
      button.textContent = i + 1;
      button.setAttribute('aria-label','Cena ' + (i + 1) + ': ' + chapter.title);
      if (i === scene) button.setAttribute('aria-current','step');
      button.addEventListener('click',() => renderScene(i,true));
      return button;
    }));
    if (focus) {
      $('chapter-title').tabIndex = -1;
      $('chapter-title').focus({preventScroll:true});
      const anchor = matchMedia('(max-width:900px)').matches ? $('reader-heading') : $('reader-view');
      anchor.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }
  function finish() {
    stopSpeech(false);
    const panel = $(sample ? 'sample-end' : 'reader-end');
    panel.hidden = false;
    $('next-button').disabled = true;
    $('voice-status').textContent = sample ? 'Amostra concluída. As vendas ainda não estão abertas.' : 'Fim da história. Agora, uma pequena conversa.';
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  // Só português: aceita pt-BR/pt-PT (e pt_BR/pt_PT, qualquer caixa). Nada de pt-AO, es-*, en-* etc.
  function ptLocale(voice) {
    const lang = String(voice?.lang || '').replace('_', '-');
    if (/^pt-pt/i.test(lang)) return 'pt-PT';
    if (/^pt-br/i.test(lang)) return 'pt-BR';
    return null;
  }
  function populateVoices(selectNatural = false) {
    if (!synth) return;
    const hasNatural = Boolean(activeBook?.audio);
    const selected = selectNatural && hasNatural ? 'natural' : $('voice-select').value;
    // Agrupa por variante (pt-BR / pt-PT) pra decidir a qualidade dentro de cada uma
    // separadamente: uma pt-PT boa não deve sumir só porque existe uma pt-BR melhor, e
    // vice-versa. Dentro de cada grupo, mantém as vozes de melhor qualidade (rankVoice >= 70:
    // Natural, Google, Premium/Enhanced, Francisca/Thalita/Antônio/Luciana/Fernanda); só cai
    // para as genéricas/antigas quando o grupo não tem nenhuma de qualidade, pra nunca ficar
    // com o grupo vazio.
    const groups = new Map();
    synth.getVoices().forEach(v => {
      const locale = ptLocale(v);
      if (!locale) return;
      if (!groups.has(locale)) groups.set(locale, []);
      groups.get(locale).push(v);
    });
    voices = [];
    groups.forEach(list => {
      const ranked = list.slice().sort((a,b) => rankVoice(b) - rankVoice(a));
      const quality = ranked.filter(v => rankVoice(v) >= 70);
      voices.push(...(quality.length ? quality : ranked));
    });
    voices.sort((a,b) => rankVoice(b) - rankVoice(a));
    const automatic = document.createElement('option');
    automatic.value = ''; automatic.textContent = 'Automática · melhor voz em português';
    const options = [];
    if (hasNatural) {
      const natural = document.createElement('option');
      natural.value = 'natural'; natural.textContent = 'Narração Pirilume · voz natural';
      options.push(natural);
    }
    options.push(automatic,...voices.map(v => {
      const o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = shortVoiceName(v.name) + (ptLocale(v) === 'pt-PT' ? ' · Portugal' : '');
      return o;
    }));
    $('voice-select').replaceChildren(...options);
    if (hasNatural && selected === 'natural') $('voice-select').value = 'natural';
    else if (voices.some(v => v.voiceURI === selected)) $('voice-select').value = selected;
  }
  function startSpeaking(readAnswer = false) {
    if (!synth || !('SpeechSynthesisUtterance' in window)) return;
    stopSpeech(false);
    const token = ++run;
    speaking = true; paused = false; speechUI();
    const paragraphs = readAnswer ? [story[scene].answer] : story[scene].paragraphs;
    if (readAnswer) {
      $('discovery-button').disabled = true;
      $('interaction-cue').hidden = false;
      $('interaction-cue').textContent = 'Vamos ouvir a descoberta. A história continua em seguida.';
      $('discovery-answer').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }
    let paragraph = 0;
    function naturalSegmentFor(index) {
      if (!naturalSelected()) return null;
      const naturalScene = activeBook.audio.scenes?.[scene];
      if (!naturalScene) return null;
      if (!readAnswer && !naturalScene.src) return null;
      const range = readAnswer ? naturalScene.answer : naturalScene.paragraphs?.[index];
      if (!range) return null;
      // Descoberta pode ter arquivo próprio: {src,start,end}. Sem src válido, cai na voz do aparelho.
      if (!Array.isArray(range)) return range.src ? { src: range.src, start: range.start || 0, end: range.end ?? null } : null;
      return { src: naturalScene.src, start: range[0], end: range[1] };
    }
    function highlightAndStatus(voiceLabel) {
      document.querySelectorAll('#story-text p').forEach((p,i) => p.classList.toggle('is-speaking',!readAnswer && i === paragraph));
      $('voice-status').textContent = (readAnswer ? 'Ouvindo a descoberta da cena ' : 'Ouvindo a cena ') + (scene + 1) + (voiceLabel ? ' · ' + voiceLabel : '.');
    }
    function afterParagraph() { if (token === run) { paragraph++; readNext(); } }
    function speakUtterance() {
      engine = 'synth';
      const utterance = new SpeechSynthesisUtterance(paragraphs[paragraph]);
      utteranceRef = utterance;
      utterance.lang = activeBook?.language || 'pt-BR'; utterance.rate = .9; utterance.pitch = 1;
      // Automática (valor vazio) ou seleção manual que sumiu da lista: usa a voz de maior
      // pontuação (voices já vem ordenada por rankVoice em populateVoices). Escolha manual
      // válida do usuário é sempre respeitada.
      const manualValue = $('voice-select').value;
      const manualVoice = manualValue && manualValue !== 'natural' ? voices.find(v => v.voiceURI === manualValue) : null;
      const selected = manualVoice || voices[0];
      if (selected) utterance.voice = selected;
      utterance.onstart = () => {
        if (token !== run) return;
        highlightAndStatus(selected ? shortVoiceName(selected.name) : 'Voz automática em português');
      };
      utterance.onend = () => afterParagraph();
      utterance.onerror = event => {
        if (token !== run || event.error === 'interrupted' || event.error === 'canceled') return;
        stopSpeech(false);
        $('voice-status').textContent = 'A voz não pôde ser reproduzida neste aparelho. Tente outra voz em português ou continue pela leitura.';
      };
      synth.speak(utterance);
    }
    function speakNatural(segment) {
      engine = 'natural';
      playNaturalSegment(segment, {
        onStart: () => { if (token === run) highlightAndStatus('Narração Pirilume.'); },
        onEnd: afterParagraph,
        onFail: () => { if (token === run) speakUtterance(); }
      }, token);
    }
    function readNext() {
      if (token !== run) return;
      if (paragraph >= paragraphs.length) {
        speaking = false; paused = false; speechUI();
        document.querySelectorAll('#story-text p').forEach(p => p.classList.remove('is-speaking'));
        if (readAnswer) {
          $('discovery-button').disabled = false;
          $('interaction-cue').textContent = 'Descoberta concluída. Virando a página…';
          if (!$('auto-advance').checked) {
            $('interaction-cue').textContent = 'Descoberta concluída. Continue quando quiser.';
            return;
          }
          nextNarrationTimer = setTimeout(() => {
            if (token !== run || !$('auto-advance').checked) return;
            if (scene + 1 >= limit) { finish(); return; }
            renderScene(scene + 1, true);
            nextNarrationTimer = setTimeout(() => startSpeaking(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1350);
            $('stop-button').disabled = false;
          }, 650);
          $('stop-button').disabled = false;
          return;
        }
        if ($('auto-advance').checked) {
          awaitingInteraction = true;
          const discovered = $('discovery-button').getAttribute('aria-expanded') === 'true';
          if (discovered) { startSpeaking(true); return; }
          $('interaction-cue').textContent = discovered ? 'Conversem no seu tempo. Depois, toque em Continuar a história.' : 'Sua vez de participar ✦ Toque no botão abaixo e descubram juntos.';
          $('interaction-cue').hidden = false;
          $('discovery-button').setAttribute('data-awaiting', String(!discovered));
          $('discovery-button').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
          $('voice-status').textContent = 'Sua vez de participar. Toque na descoberta: a voz lê a resposta e continua a história.';
          $('next-button').textContent = scene + 1 < limit ? 'Continuar a história →' : 'Conversar sobre o final →';
        } else $('voice-status').textContent = 'Cena concluída. Você pode explorar a descoberta ou seguir para a próxima.';
        return;
      }
      const segment = naturalSegmentFor(paragraph);
      if (segment) speakNatural(segment); else speakUtterance();
    }
    readNext();
  }
  $('speak-button').addEventListener('click',() => {
    if (!speaking) startSpeaking();
    else if (paused) {
      if (engine === 'natural' && player) player.play(); else synth.resume();
      paused = false; speechUI();
    } else {
      if (engine === 'natural' && player) player.pause(); else synth.pause();
      paused = true; speechUI();
    }
  });
  $('stop-button').addEventListener('click',() => stopSpeech());
  $('voice-select').addEventListener('change',() => stopSpeech());
  $('auto-advance').addEventListener('change',() => {
    if (!$('auto-advance').checked) {
      clearTimeout(nextNarrationTimer); nextNarrationTimer = null;
      awaitingInteraction = false;
      $('interaction-cue').hidden = true;
      $('discovery-button').setAttribute('data-awaiting','false');
    }
  });
  $('prev-button').addEventListener('click',() => renderScene(scene-1,true));
  $('next-button').addEventListener('click',() => {
    const resumeNarration = $('auto-advance').checked && (awaitingInteraction || speaking);
    if (scene + 1 >= limit) { finish(); return; }
    renderScene(scene+1,true);
    if (resumeNarration) {
      // Leave time for the page to settle; stopSpeech cancels this on any navigation.
      nextNarrationTimer = setTimeout(startSpeaking, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1350);
    }
  });
  $('restart-button').addEventListener('click',() => renderScene(0,true));
  $('discovery-button').setAttribute('aria-controls','discovery-answer');
  $('discovery-button').addEventListener('click',() => {
    const expanded = $('discovery-button').getAttribute('aria-expanded') === 'true';
    $('discovery-answer').hidden = expanded;
    $('discovery-button').setAttribute('aria-expanded',String(!expanded));
    $('discovery-button').setAttribute('data-awaiting', 'false');
    if (awaitingInteraction) {
      if (!expanded && $('auto-advance').checked) startSpeaking(true);
    }
  });
  if (synth) {
    populateVoices();
    synth.addEventListener('voiceschanged',() => populateVoices());
  } else {
    $('speak-button').disabled = true; $('voice-select').disabled = true; $('auto-advance').disabled = true;
  }
  function route() {
    const hash = location.hash || '#inicio';
    if (hash === '#main') return;
    if (audioPreview) audioPreview.pause();
    const requestedId = hash.startsWith('#livro/') ? hash.slice(7) : 'luzes';
    const requested = window.PIRILUME_BOOKS?.find(book => book.id === requestedId && book.chapters?.length);
    const reading = hash === '#ler' || hash === '#amostra' || Boolean(requested && hash.startsWith('#livro/'));
    document.title = reading ? 'Pirilume · ' + (requested?.title || 'O bosque das pequenas luzes') : 'Pirilume · Nino e os amigos do bosque';
    $('home-view').hidden = reading; $('reader-view').hidden = !reading;
    stopSpeech();
    if (reading) {
      activeBook = requested || window.PIRILUME_BOOKS?.[0];
      if (activeBook) {
        story = activeBook.chapters;
        window.PIRILUME_ACTIVE_BOOK = activeBook;
        $('reader-heading').textContent = activeBook.title;
        $('cover-title').textContent = activeBook.title;
        $('cover-subtitle').textContent = activeBook.subtitle;
        $('book-picker').value = activeBook.id;
        $('scene-friends').textContent = activeBook.friend;
        $('cover-art').style.backgroundImage = `url('${activeBook.cover}')`;
        $('cover-art').style.backgroundSize = `${activeBook.columns*100}% ${activeBook.rows*100}%`;
        $('cover-art').setAttribute('aria-label',activeBook.coverAlt || activeBook.subtitle);
        $('end-questions').replaceChildren(...activeBook.questions.map(text=>{const p=document.createElement('p');p.textContent=text;return p}));
        $('end-title').textContent = activeBook.free ? 'Qual foi a sua pequena luz hoje?' : 'O que fica desta aventura?';
      }
      sample = false; limit = story.length;
      $('reader-mode').textContent = activeBook && !activeBook.free ? 'COLEÇÃO · REVISÃO COMPLETA' : 'HISTÓRIA COMPLETA · GRATUITA';
      if (synth) populateVoices(true);
      renderScene(0);
      $('reader-view').scrollIntoView({block:'start'});
    } else if (hash === '#oferta') $('offer-section').scrollIntoView({block:'start'});
    else if (hash === '#colecao') $('colecao').scrollIntoView({block:'start'});
    else if (hash !== '#main') window.scrollTo({top:0});
  }
  window.addEventListener('hashchange',route);
  // cues.json do livro gratuito pode chegar depois do primeiro render (fetch em library.js);
  // se o leitor ainda não começou a falar, atualiza a lista de vozes para oferecer a natural.
  window.addEventListener('pirilume-audio-ready', event => {
    if (synth && !speaking && activeBook && event.detail && activeBook.id === event.detail.id) populateVoices(true);
  });
  window.addEventListener('pagehide',() => { stopSpeech(false); if (audioPreview) audioPreview.pause(); });
  document.addEventListener('visibilitychange',() => {
    if (document.hidden && (speaking || nextNarrationTimer !== null)) stopSpeech();
    if (document.hidden && audioPreview) audioPreview.pause();
  });
  route();
})();
