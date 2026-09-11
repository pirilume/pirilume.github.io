(() => {
  // Contagem anônima de visitas via GoatCounter: sem cookies, sem IP e sem dado
  // pessoal armazenado. Respeita "Não rastrear" do navegador não carregando nada.
  if (navigator.doNotTrack === '1' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  const SITE = 'pirilume';

  window.goatcounter = { no_onload: false, allow_local: false };

  let pronto = false;
  const fila = [];

  function evento(nome) {
    if (pronto && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'evento/' + nome, event: true });
    } else {
      fila.push(nome);
    }
  }

  const script = document.createElement('script');
  script.async = true;
  script.setAttribute('data-goatcounter', `https://${SITE}.goatcounter.com/count`);
  script.src = '//gc.zgo.at/count.js';
  script.onload = () => {
    pronto = true;
    while (fila.length) evento(fila.shift());
  };
  document.head.appendChild(script);

  // Clique em "Comprar" (topo, seção da coleção, faixa/cartão durante a leitura ou cartão ao
  // final da história gratuita).
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('#buy-collection, #buy-collection-hero, #end-upsell-buy, #offer-strip-buy, #offer-mid-buy, #account-buy');
    if (alvo) evento('clique-comprar');
  });

  // Versão 2: chegada à rota não significa abertura nem leitura.
  function checarHistoriaGratis() {
    if (['#livro/luzes', '#amostra', '#ler'].includes(location.hash)) evento('funil-v2/chegou-historia');
  }
  checarHistoriaGratis();
  window.addEventListener('hashchange', checarHistoriaGratis);

  // Cartão de convite à coleção, exibido ao final da história gratuita (app.js dispara).
  window.addEventListener('pirilume-fim-historia-gratis', () => evento('terminou-historia-gratis'));

  // Curva de abandono da história gratuita: uma cena por evento (app.js garante uma vez por
  // cena por sessão), para ler no GoatCounter em que cena as pessoas param de ler.
  window.addEventListener('pirilume-cena', (e) => {
    const cena = e.detail && e.detail.cena;
    if (cena) evento('leitura-v2/cena-visivel-' + String(cena).padStart(2, '0'));
  });

  // Cartão de oferta no meio da história gratuita (cena 4), exibido pela primeira vez na sessão.
  window.addEventListener('pirilume-oferta-meio', () => evento('viu-oferta-meio'));

  // Livro passou para o estado aberto (automático na chegada por link externo, ou clique manual
  // em "Abrir o livro"), disparado por book.js uma única vez por sessão. Separa "chegou na
  // página" de "viu a história de verdade"; o segundo evento abaixo recorta só a abertura por clique.
  const aberturas = new Set();
  window.addEventListener('pirilume-livro-aberto', (event) => {
    if (!event.detail?.gratuito) return;
    const modo = event.detail.automatico ? 'automatico' : 'toque';
    if (aberturas.has(modo)) return;
    aberturas.add(modo);
    evento('funil-v2/livro-aberto-' + modo);
  });

  // Etapas reais do fluxo, sem e-mail, tokens ou identificadores pessoais.
  for (const etapa of ['conta-aberta', 'auth-sucesso', 'auth-erro', 'checkout-iniciado', 'checkout-erro', 'compra-confirmada']) {
    window.addEventListener('pirilume-' + etapa, () => evento('funil-v2/' + etapa));
  }

  // Clicou em "Ouvir cena" e a narração começou (app.js garante uma vez por sessão).
  window.addEventListener('pirilume-apertou-ouvir', () => evento('apertou-ouvir'));

  // Narração natural (MP3) chegou ao fim da cena (app.js garante uma vez por cena por sessão).
  window.addEventListener('pirilume-ouviu-cena-inteira', (e) => { const c = e.detail && e.detail.cena; if (c) evento('ouviu-inteira/cena-' + String(c).padStart(2, '0')); });

  // Retorno do Mercado Pago (?compra= na URL), sem ler valor nem dado pessoal.
  if (new URLSearchParams(location.search).has('compra')) {
    evento('voltou-do-pagamento');
  }
})();

// Pixel/Conjunto de dados da Meta, para medir anúncios — só entra com consentimento
// explícito (LGPD). Sem metaDatasetId configurado, nada aqui roda: nenhum aviso,
// nenhum código da Meta é carregado (mesmo comportamento de antes desta mudança).
(() => {
  if (navigator.doNotTrack === '1' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  const metaDatasetId = (window.PIRILUME_METRICA && window.PIRILUME_METRICA.metaDatasetId) || '';
  if (!metaDatasetId) return;

  const CONSENT_KEY = 'pirilume.consent';

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
  }
  function setConsent(valor) {
    try { localStorage.setItem(CONSENT_KEY, valor); } catch {}
  }

  function carregarPixel() {
    if (typeof window.fbq === 'function') return;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', metaDatasetId);
    window.fbq('track', 'PageView');
  }

  let viuHistoria = false;
  let viewContentEnviado = false;
  function checarHistoriaGratisMeta() {
    if (viuHistoria && !viewContentEnviado && getConsent() === 'aceito' && typeof window.fbq === 'function') {
      viewContentEnviado = true;
      window.fbq('track', 'ViewContent', { content_name: 'O bosque das pequenas luzes', content_type: 'product' });
    }
  }
  window.addEventListener('pirilume-livro-aberto', (event) => {
    if (event.detail?.gratuito) viuHistoria = true;
    checarHistoriaGratisMeta();
  });

  // Só conta quando o servidor criou um checkout válido, independentemente do botão de origem.
  window.addEventListener('pirilume-checkout-iniciado', () => {
    if (getConsent() === 'aceito' && typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', { value: 19.90, currency: 'BRL', content_ids: ['colecao-1'] });
    }
  });

  // O cliente exige aprovação do pedido atual pelo servidor, não apenas acesso à biblioteca.
  window.addEventListener('pirilume-compra-confirmada', () => {
    if (getConsent() !== 'aceito') return;
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', 'Purchase', { value: 19.90, currency: 'BRL', content_ids: ['colecao-1'] });
  });

  function fecharAviso(aviso) {
    aviso.remove();
  }

  function mostrarAviso() {
    const existente = document.getElementById('consent-banner');
    if (existente) existente.remove();
    const aviso = document.createElement('div');
    aviso.id = 'consent-banner';
    aviso.className = 'consent-banner';
    aviso.setAttribute('role', 'region');
    aviso.setAttribute('aria-label', 'Preferências de cookies');
    aviso.innerHTML =
      '<p>Usamos uma contagem anônima de visitas (sem cookies). Para medir nossos anúncios, ' +
      'podemos usar o pixel da Meta, que usa cookies. Você escolhe: ' +
      '<a href="termos.html#privacidade">Saiba mais</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-accept">Aceitar</button>' +
      '<button type="button" class="consent-essential">Só o essencial</button>' +
      '</div>';
    document.body.appendChild(aviso);
    aviso.querySelector('.consent-accept').addEventListener('click', () => {
      setConsent('aceito');
      carregarPixel();
      checarHistoriaGratisMeta();
      fecharAviso(aviso);
    });
    aviso.querySelector('.consent-essential').addEventListener('click', () => {
      setConsent('essencial');
      fecharAviso(aviso);
    });
  }

  function iniciar() {
    if (navigator.doNotTrack === '1') {
      if (!getConsent()) setConsent('essencial');
      return;
    }
    const consentimento = getConsent();
    if (consentimento === 'aceito') { carregarPixel(); return; }
    if (consentimento === 'essencial') return;
    mostrarAviso();
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);

  // Link "Preferências de cookies" no rodapé: reabre o aviso para trocar a escolha.
  const linkPreferencias = document.getElementById('cookie-preferences');
  if (linkPreferencias) {
    linkPreferencias.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarAviso();
    });
  }
})();
