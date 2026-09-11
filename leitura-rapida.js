// Barra fixa "leitura rápida" (só celular): espelha #speak-button e #next-button
// já existentes, sem reimplementar nenhuma lógica de leitura/narração/paginação.
// Defensivo: qualquer elemento ausente é ignorado, nunca lança erro.
(function () {
  'use strict';

  function $(id) {
    try { return document.getElementById(id); } catch (e) { return null; }
  }

  var barra = $('leitura-rapida');
  if (!barra) return; // markup novo ausente: nada a fazer, não quebra o resto do site.

  var btnOuvir = $('lr-ouvir');
  var elContador = $('lr-contador');
  var btnProxima = $('lr-proxima');

  var reader = $('reader-view');
  var readerEnd = $('reader-end');
  var speak = $('speak-button');
  var next = $('next-button');
  var sceneCounter = $('scene-counter');

  // --- visibilidade da barra: só com o leitor aberto e a história em andamento ---
  function atualizarVisibilidade() {
    try {
      var mostrar = Boolean(
        reader &&
        !reader.hidden &&
        !reader.classList.contains('book-closed') &&
        !(readerEnd && !readerEnd.hidden)
      );
      barra.hidden = !mostrar;
    } catch (e) {}
  }

  if (reader && typeof MutationObserver !== 'undefined') {
    try {
      new MutationObserver(atualizarVisibilidade).observe(reader, {
        attributes: true,
        attributeFilter: ['hidden', 'class'],
      });
    } catch (e) {}
  }
  if (readerEnd && typeof MutationObserver !== 'undefined') {
    try {
      new MutationObserver(atualizarVisibilidade).observe(readerEnd, {
        attributes: true,
        attributeFilter: ['hidden'],
      });
    } catch (e) {}
  }
  atualizarVisibilidade();

  // --- #lr-ouvir espelha texto/disabled de #speak-button e delega o clique ---
  function sincronizarOuvir() {
    if (!btnOuvir || !speak) return;
    try {
      btnOuvir.textContent = speak.textContent;
      btnOuvir.disabled = speak.disabled;
    } catch (e) {}
  }
  if (btnOuvir && speak) {
    if (typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(sincronizarOuvir).observe(speak, {
          childList: true,
          characterData: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['disabled'],
        });
      } catch (e) {}
    }
    sincronizarOuvir();
    btnOuvir.addEventListener('click', function () {
      try { speak.click(); } catch (e) {}
    });
  }

  // --- #lr-proxima espelha disabled de #next-button e delega o clique ---
  function sincronizarProxima() {
    if (!btnProxima || !next) return;
    try {
      btnProxima.disabled = next.disabled;
      btnProxima.textContent = /Conversar|Concluir/.test(next.textContent) ? 'Finalizar →' : 'Próxima →';
    } catch (e) {}
  }
  if (btnProxima && next) {
    if (typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(sincronizarProxima).observe(next, {
          attributes: true,
          attributeFilter: ['disabled'],
          childList: true,
          characterData: true,
          subtree: true,
        });
      } catch (e) {}
    }
    sincronizarProxima();
    btnProxima.addEventListener('click', function () {
      try { next.click(); } catch (e) {}
    });
  }

  // --- #lr-contador espelha #scene-counter em formato curto "3/8" ---
  function sincronizarContador() {
    if (!elContador || !sceneCounter) return;
    try {
      var texto = sceneCounter.textContent || '';
      var m = /CENA\s*(\d+)\s*DE\s*(\d+)/i.exec(texto);
      elContador.textContent = m ? (m[1] + '/' + m[2]) : '';
    } catch (e) {}
  }
  if (elContador && sceneCounter) {
    if (typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(sincronizarContador).observe(sceneCounter, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      } catch (e) {}
    }
    sincronizarContador();
  }

  // --- não sobrepor a faixa de consentimento de cookies (fixa no rodapé também) ---
  // Solução simples: medir a altura real da faixa (ela pode quebrar em mais linhas
  // em telas bem pequenas) e empurrar a barra para cima nessa altura via variável
  // CSS; sem faixa no DOM, a variável some e a barra volta para bottom:0.
  function ajustarOffsetConsentimento() {
    try {
      var consent = document.getElementById('consent-banner') || document.querySelector('.consent-banner');
      if (consent) {
        var altura = consent.getBoundingClientRect().height;
        barra.style.setProperty('--lr-consent-offset', altura + 'px');
      } else {
        barra.style.removeProperty('--lr-consent-offset');
      }
    } catch (e) {}
  }
  ajustarOffsetConsentimento();
  try { window.addEventListener('resize', ajustarOffsetConsentimento); } catch (e) {}
  if (typeof MutationObserver !== 'undefined' && document.body) {
    try {
      new MutationObserver(ajustarOffsetConsentimento).observe(document.body, { childList: true });
    } catch (e) {}
  }
})();
