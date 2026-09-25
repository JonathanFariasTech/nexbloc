/* ==========================================================================
   NexBloc · Apresentação animada "Torre de Blocos"
   Navegação estilo slides (TED / Google I/O): teclado, roda de mouse,
   swipe, torre lateral clicável, autoplay e tela cheia.
   ========================================================================== */
(() => {
  'use strict';

  const slides    = Array.from(document.querySelectorAll('.slide'));
  const towerBtns = Array.from(document.querySelectorAll('.tower-link:not(.bmc-link)'));
  const bmcLink   = document.querySelector('.tower-link.bmc-link');
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

  /* ---- fotos dos integrantes: aceita extensões flexíveis (.jpg, .jpeg,
        .png, .webp) e nomes com maiúsculas, acentos ou sufixos.
        Ex.: data-photo="assets/team/jonathan.jpg" encontra também
        "jonathan.jpeg", "Jonathan - Foto.JPEG", "jonathan_foto.png".
        Estratégia: tenta carregar cada candidato real com Image(); o primeiro
        que responder vira a foto. Se nenhum existir, o placeholder permanece. ---- */
  function tryLoad(url) {
    return new Promise((resolve, reject) => {
      const t = new Image();
      t.onload = () => resolve(url);
      t.onerror = () => reject(new Error(url));
      t.src = url;
    });
  }
  async function resolvePhoto(src) {
    const m = src.match(/^(.*\/)?(.+?)\.([A-Za-z0-9]+)$/);
    if (!m) return [src];
    const [, dir = '', base] = m;
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, ''); // "josé da silva" -> "josedasilva"
    const candidates = [src];
    for (const ext of ['jpeg', 'jpg', 'png', 'webp']) {
      candidates.push(`${dir}${base}.${ext}`);                 // exato, outra extensão
      candidates.push(`${dir}${base}.${ext.toUpperCase()}`);   // extensão maiúscula
    }
    for (const sep of ['', '-', '_', ' ', '%20']) {
      for (const suf of ['foto', 'fotografia', 'profile', 'avatar', 'img', 'image']) {
        candidates.push(`${dir}${base}${sep}${suf}.jpeg`, `${dir}${base}${sep}${suf}.jpg`);
      }
    }
    // variantes com espaços/underline no lugar do hífen do nome
    if (base.includes('-')) {
      for (const alt of [base.replace(/-/g, ' '), base.replace(/-/g, '_'), base.replace(/-/g, '')]) {
        candidates.push(`${dir}${alt}.jpeg`, `${dir}${alt}.jpg`);
      }
    }
    // última chance: varre arquivos da pasta cujo nome normalizado coincida
    try {
      const r = await fetch(dir);
      if (r.ok) {
        const html = await r.text();
        const re = /href="([^"?#]+?)"/gi;
        let mm;
        while ((mm = re.exec(html))) {
          const name = decodeURIComponent(mm[1]);
          if (name.startsWith('../') || name.startsWith('/')) continue;
          const f = name.match(/^(.+?)\.(jpe?g|png|webp)$/i);
          if (f && f[1].toLowerCase().replace(/[^a-z0-9]+/g, '').startsWith(slug)) {
            candidates.unshift(`${dir}${encodeURI(name)}`);
          }
        }
      }
    } catch (_) { /* file:// ou sem listagem — segue com os candidatos diretos */ }
    return [...new Set(candidates)];
  }
  document.querySelectorAll('.avatar[data-photo]').forEach(av => {
    const img = document.createElement('img');
    img.className = 'avatar-photo';
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('load', () => av.classList.add('has-photo'));
    img.addEventListener('error', () => {
      // fallback silencioso: remove o <img>, mantém placeholder
      img.remove();
      av.classList.remove('has-photo');
    });
    resolvePhoto(av.dataset.photo).then(async (list) => {
      for (const url of list) {
        try { await tryLoad(url); img.src = url; return; } catch (_) {}
      }
    });
    av.appendChild(img);
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
    refreshBmcLink();

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

  /* ------------------------------- abas (slide Empresa) ------------------ */
  const tabbar = document.querySelector('.tabbar');
  function refreshBmcLink() { // destaca o link "Canvas" na torre apenas quando a aba canvas está ativa
    if (!bmcLink || !tabbar) return;
    bmcLink.classList.toggle('active', current === +bmcLink.dataset.goto && !!tabbar.querySelector('.tab[data-tab="canvas"].is-active'));
  }
  function setTab(name) {
    const slide = document.getElementById('slide-1');
    if (!slide) return;
    slide.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    slide.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    /* reescala as animações .reveal do painel recém-mostrado */
    const panel = slide.querySelector(`.tab-panel[data-panel="${name}"]`);
    if (panel) panel.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', String(120 + i * 90)));
    refreshBmcLink();
  }
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => setTab(t.dataset.tab))
  );

  /* ----------------------------- eventos UI ----------------------------- */
  document.querySelectorAll('[data-goto]').forEach(el =>
    el.addEventListener('click', () => {
      stopAutoplay();
      if (el.dataset.tabTarget) setTab(el.dataset.tabTarget); // ex.: "Canvas de negócio" na torre
      goTo(+el.dataset.goto);
    })
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
        if (/^[0-7]$/.test(e.key)) { stopAutoplay(); goTo(+e.key); }
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
