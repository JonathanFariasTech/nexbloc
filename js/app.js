/* ==========================================================================
   NexBloc · Apresentação animada "Torre de Blocos"
   Navegação estilo slides (TED / Google I/O): teclado, roda de mouse,
   swipe, torre lateral clicável, autoplay e tela cheia.
   ========================================================================== */
(() => {
  'use strict';

  const slides    = Array.from(document.querySelectorAll('.slide'));
  const towerBtns = Array.from(document.querySelectorAll('.tower-link'));
  const miniBlks  = Array.from(document.querySelectorAll('.mini-block'));
  const bar       = document.getElementById('progressBar');
  const curNum    = document.getElementById('curNum');
  const totNum    = document.getElementById('totNum');
  const hint      = document.getElementById('hint');
  const btnPrev   = document.getElementById('btnPrev');
  const btnNext   = document.getElementById('btnNext');
  const btnPlay   = document.getElementById('btnPlay');
  const btnFull   = document.getElementById('btnFull');
  const icoPlay   = document.getElementById('icoPlay');
  const icoPause  = document.getElementById('icoPause');

  const TOTAL = slides.length;
  let current = 0;
  let locked  = false;          // trava anti-spam de transições
  let autoplay = null;
  const AUTOPLAY_MS = 12000;

  totNum.textContent = String(TOTAL - 1).padStart(2, '0');

  /* ---- escalona as animações .reveal dentro de cada slide ---- */
  slides.forEach(slide => {
    slide.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.setProperty('--d', 180 + i * 130);
    });
  });

  /* ---- fotos dos integrantes: carrega data-photo só se o arquivo existir
        (evita requests quebrados; placeholders aparecem até a foto ser adicionada) ---- */
  const setPhoto = av => {
    av.style.setProperty('--photo', `url("${av.dataset.photo}")`);
    av.classList.add('has-photo');
  };
  /* Pré-carrega as fotos via fetch (respostas de rede não sujam o console).
     Se o arquivo ainda não existir, o placeholder é mantido. */
  const tryLoad = src => new Promise(res => {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => { ctl?.abort(); res(false); }, 5000);
    fetch(src, ctl ? { signal: ctl.signal } : {})
      .then(r => { clearTimeout(timer); res(r.ok); })
      .catch(() => { clearTimeout(timer); res(false); });
  });
  document.querySelectorAll('.avatar[data-photo]').forEach(av => {
    tryLoad(av.dataset.photo).then(ok => { if (ok) setPhoto(av); });
  });

  /* ---- sparkline do slide de monitoramento (dados fake plausíveis) ---- */
  const spark = document.getElementById('sparkLine');
  if (spark) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * 296 + 2;
      const y = 55 + Math.sin(i * 0.9) * 14 + Math.sin(i * 2.7) * 7 + (Math.random() * 6 - 3);
      pts.push(`${x.toFixed(1)},${Math.max(6, Math.min(84, y)).toFixed(1)}`);
    }
    spark.setAttribute('points', pts.join(' '));
  }

  /* ------------------------- navegação principal ------------------------ */
  function goTo(n) {
    n = Math.max(0, Math.min(TOTAL - 1, n));
    if (n === current && slides[n].classList.contains('is-active')) return;
    locked = true;
    setTimeout(() => (locked = false), 850);

    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === n);
      s.classList.toggle('is-prev', i < n);
      if (i !== n) s.scrollTop = 0;
    });
    current = n;

    /* HUD */
    bar.style.width = (n / (TOTAL - 1)) * 100 + '%';
    curNum.textContent = String(n).padStart(2, '0');

    /* torre: acende o bloco correspondente (slides 1..5 = blocos 1..5) */
    towerBtns.forEach(b => b.classList.toggle('active', +b.dataset.goto === n));
    miniBlks.forEach(b => {
      const blk = +b.dataset.slide;
      b.classList.toggle('lit', n > 0 ? blk <= n : false);
    });

    runCounters(slides[n]);
    animateLatency(slides[n]);

    hint.classList.add('hide');
  }

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  /* --------------------------- contadores KPI --------------------------- */
  function runCounters(slide) {
    slide.querySelectorAll('[data-count]').forEach(el => {
      const target   = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const dur      = 1400;
      const t0       = performance.now();
      const fmt      = v => v.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      });
      function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }

  /* -------------------- medidor de latência (slide 3) -------------------- */
  function animateLatency(slide) {
    const num = slide.querySelector('#latNum');
    if (!num) return;
    const target = 18, dur = 1600, t0 = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      num.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ----------------------------- eventos UI ----------------------------- */
  document.querySelectorAll('[data-goto]').forEach(el =>
    el.addEventListener('click', () => { stopAutoplay(); goTo(+el.dataset.goto); })
  );
  miniBlks.forEach(el =>
    el.addEventListener('click', () => { stopAutoplay(); goTo(+el.dataset.slide); })
  );
  btnNext.addEventListener('click', () => { stopAutoplay(); next(); });
  btnPrev.addEventListener('click', () => { stopAutoplay(); prev(); });

  /* teclado */
  window.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const nativeBtn = document.activeElement?.closest?.('button');
    switch (e.key) {
      case 'ArrowRight': case 'PageDown':
        e.preventDefault(); stopAutoplay(); next(); break;
      case ' ': case 'Enter':
        if (typing || nativeBtn) break; // deixa o botão focado agir naturalmente
        e.preventDefault(); stopAutoplay(); next(); break;
      case 'ArrowLeft': case 'PageUp':
        e.preventDefault(); stopAutoplay(); prev(); break;
      case 'Home': e.preventDefault(); stopAutoplay(); goTo(0); break;
      case 'End':  e.preventDefault(); stopAutoplay(); goTo(TOTAL - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      default:
        if (/^[0-6]$/.test(e.key)) { stopAutoplay(); goTo(+e.key); }
    }
  });

  /* roda de mouse (com trava) */
  let wheelTimer = null;
  window.addEventListener('wheel', e => {
    if (e.deltaMode === 1 && Math.abs(e.deltaY) < 1) return; // linha
    if (e.deltaMode !== 1 && Math.abs(e.deltaY) < 24) return; // pixel
    if (locked) return;
    const slideEl = slides[current];
    const canScroll = slideEl.scrollHeight > slideEl.clientHeight + 4;
    if (canScroll) {
      const atTop = slideEl.scrollTop <= 2;
      const atBottom = slideEl.scrollTop + slideEl.clientHeight >= slideEl.scrollHeight - 4;
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return; // deixa rolar o conteúdo
    }
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { stopAutoplay(); e.deltaY > 0 ? next() : prev(); }, 60);
  }, { passive: true });

  /* swipe (touch) */
  let tx = 0, ty = 0;
  window.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { stopAutoplay(); dx < 0 ? next() : prev(); }
  }, { passive: true });

  /* autoplay (estilo TED: avança sozinho) */
  function startAutoplay() {
    autoplay = setInterval(() => (current < TOTAL - 1 ? next() : goTo(0)), AUTOPLAY_MS);
    icoPlay.hidden = true; icoPause.hidden = false;
    btnPlay.classList.add('on');
  }
  function stopAutoplay() {
    clearInterval(autoplay); autoplay = null;
    icoPlay.hidden = false; icoPause.hidden = true;
    btnPlay.classList.remove('on');
  }
  btnPlay.addEventListener('click', () => (autoplay ? stopAutoplay() : startAutoplay()));

  /* tela cheia */
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  btnFull.addEventListener('click', toggleFullscreen);

  /* inicia no slide 0 */
  goTo(0);
})();
