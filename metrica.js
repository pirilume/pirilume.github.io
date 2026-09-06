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

  // Clique em "Comprar" (topo ou seção da coleção).
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('#buy-collection, #buy-collection-hero');
    if (alvo) evento('clique-comprar');
  });

  // Abertura da história gratuita.
  function checarHistoriaGratis() {
    if (location.hash === '#livro/luzes') evento('abriu-historia-gratis');
  }
  checarHistoriaGratis();
  window.addEventListener('hashchange', checarHistoriaGratis);

  // Retorno do Mercado Pago (?compra= na URL), sem ler valor nem dado pessoal.
  if (new URLSearchParams(location.search).has('compra')) {
    evento('voltou-do-pagamento');
  }
})();
