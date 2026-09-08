(() => {
  // Contagem anônima de visitas via GoatCounter: sem cookies, sem IP e sem dado
  // pessoal armazenado. Respeita "Não rastrear" do navegador não carregando nada.
  if (navigator.doNotTrack === '1') return;

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
    const alvo = e.target.closest('#buy-collection, #buy-collection-hero, #end-upsell-buy, #offer-strip-buy, #offer-mid-buy');
    if (alvo) evento('clique-comprar');
  });

  // Abertura da história gratuita.
  function checarHistoriaGratis() {
    if (location.hash === '#livro/luzes') evento('abriu-historia-gratis');
  }
  checarHistoriaGratis();
  window.addEventListener('hashchange', checarHistoriaGratis);

  // Cartão de convite à coleção, exibido ao final da história gratuita (app.js dispara).
  window.addEventListener('pirilume-fim-historia-gratis', () => evento('terminou-historia-gratis'));

  // Curva de abandono da história gratuita: uma cena por evento (app.js garante uma vez por
  // cena por sessão), para ler no GoatCounter em que cena as pessoas param de ler.
  window.addEventListener('pirilume-cena', (e) => {
    const cena = e.detail && e.detail.cena;
    if (cena) evento('leitura/cena-' + String(cena).padStart(2, '0'));
  });

  // Cartão de oferta no meio da história gratuita (cena 4), exibido pela primeira vez na sessão.
  window.addEventListener('pirilume-oferta-meio', () => evento('viu-oferta-meio'));

  // Retorno do Mercado Pago (?compra= na URL), sem ler valor nem dado pessoal.
  if (new URLSearchParams(location.search).has('compra')) {
    evento('voltou-do-pagamento');
  }
})();

// Pixel/Conjunto de dados da Meta, para medir anúncios — só entra com consentimento
// explícito (LGPD). Sem metaDatasetId configurado, nada aqui roda: nenhum aviso,
// nenhum código da Meta é carregado (mesmo comportamento de antes desta mudança).
(() => {
  const metaDatasetId = (window.PIRILUME_METRICA && window.PIRILUME_METRICA.metaDatasetId) || '';
  if (!metaDatasetId) return;

  const CONSENT_KEY = 'pirilume.consent';
  const CHECKOUT_KEY = 'pirilume.checkout-iniciado';

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

  // ViewContent: abertura da história gratuita (mesmo gatilho do evento do GoatCounter).
  function checarHistoriaGratisMeta() {
    if (location.hash === '#livro/luzes' && typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', { content_name: 'O bosque das pequenas luzes', content_type: 'product' });
    }
  }
  checarHistoriaGratisMeta();
  window.addEventListener('hashchange', checarHistoriaGratisMeta);

  // InitiateCheckout + marca de checkout iniciado (necessária para o Purchase mais abaixo).
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('#buy-collection, #buy-collection-hero');
    if (!alvo) return;
    try { localStorage.setItem(CHECKOUT_KEY, '1'); } catch {}
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', { value: 19.90, currency: 'BRL', content_ids: ['colecao-1'] });
    }
  });

  // Purchase: só quando a biblioteca confirma acesso (pirilume-unlocked, disparado pelo
  // access.js) E existe a marca de checkout iniciado. Nunca dispara só por ?compra= ou só
  // por já estar liberado sem a marca. Some a marca depois, para não repetir a compra.
  window.addEventListener('pirilume-unlocked', () => {
    if (getConsent() !== 'aceito') return;
    let iniciouCheckout = false;
    try { iniciouCheckout = Boolean(localStorage.getItem(CHECKOUT_KEY)); } catch {}
    if (!iniciouCheckout || typeof window.fbq !== 'function') return;
    window.fbq('track', 'Purchase', { value: 19.90, currency: 'BRL', content_ids: ['colecao-1'] });
    try { localStorage.removeItem(CHECKOUT_KEY); } catch {}
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
