/**
 * Juan Londoño — Portafolio audiovisual
 * Módulos independientes; cada uno sale en silencio si su markup no existe.
 */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ============================================================
   SONIDO — sintetizado con Web Audio (sin archivos).
   Apagado por defecto; solo se crea el AudioContext tras un clic del usuario.
   ============================================================ */
const Sound = (() => {
  let ctx, master, ambient, ambientGain, noiseBuf;
  let enabled = false;
  let volume = 0.5;
  let lastHover = 0;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // 2 s de ruido blanco reutilizable
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function noise(dur, freq, q, gain, type = 'bandpass') {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random()); src.stop(t + dur);
  }

  function tone(freq, dur, gain, type = 'sine') {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur);
  }

  const sfx = {
    // "clic" de obturador: dos golpes cortos de ruido filtrado
    click() { noise(0.035, 3200, 1.2, 0.35); setTimeout(() => enabled && noise(0.05, 1800, 1, 0.22), 45); },
    // tic muy suave al pasar el cursor (con límite de frecuencia)
    hover() {
      const now = performance.now();
      if (now - lastHover < 90) return;
      lastHover = now;
      noise(0.02, 5200, 3, 0.08);
    },
    // claqueta: chasquido + golpe grave
    clap() { noise(0.08, 2400, 0.8, 0.6); tone(140, 0.18, 0.35); },
  };

  // Room tone: ruido marrón muy bajo, filtrado — la "presencia" de un set
  function startAmbient() {
    const src = ctx.createBufferSource();
    const brown = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    src.buffer = brown; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0;
    src.connect(f).connect(ambientGain).connect(master);
    src.start();
    ambient = src;
    ambientGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2);
  }

  function stopAmbient() {
    if (!ambient) return;
    const a = ambient;
    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => a.stop(), 1200);
    ambient = null;
  }

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (enabled) {
        if (!ctx) init();
        ctx.resume();
        startAmbient();
        sfx.click();
      } else {
        stopAmbient();
      }
      return enabled;
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    // baja el ambiente mientras suena un video con audio
    duck(on) {
      if (ambientGain) ambientGain.gain.setTargetAtTime(on ? 0 : 0.12, ctx.currentTime, 0.25);
    },
    play(name) { if (enabled && ctx && sfx[name]) sfx[name](); },
  };
})();

(function initSoundUI() {
  const wrap = $('#sound');
  const btn = $('#soundToggle');
  const vol = $('#soundVol');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const on = Sound.toggle();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Desactivar sonido' : 'Activar sonido');
    $('b', btn).textContent = on ? 'on' : 'off';
    wrap.classList.toggle('on', on);
  });
  vol?.addEventListener('input', () => Sound.setVolume(Number(vol.value)));

  // Delegación: cualquier [data-sfx="click"] o [data-sfx-hover]
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sfx="click"]')) Sound.play('click');
  });
  if (finePointer) {
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-sfx-hover]');
      if (el && !el.contains(e.relatedTarget)) Sound.play('hover');
    });
  }
})();

/* ============================================================
   LOADER — cuenta regresiva de leader 3·2·1 y revela el hero
   ============================================================ */
(function initLoader() {
  const loader = $('#loader');
  const n = $('.loader-n', loader || document);
  const finish = () => {
    document.body.classList.remove('is-loading');
    if (!loader) return;
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 900);
  };
  if (!loader || reduceMotion) return finish();

  let count = 3;
  const tick = setInterval(() => {
    count -= 1;
    if (count > 0) { n.textContent = count; return; }
    clearInterval(tick);
    finish();
  }, 320);
})();

/* ============================================================
   NAVEGACIÓN — estado al hacer scroll, progreso, sección activa, menú móvil
   ============================================================ */
(function initNav() {
  const nav = $('#nav');
  const bar = $('#progressBar');
  const timeline = $('.timeline');
  const heroName = $('.hero-name');
  let ticking = false;

  function update() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    nav?.classList.toggle('scrolled', y > 40);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    // Línea de tiempo del proceso: avanza como un playhead
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.3)));
      timeline.style.setProperty('--p', p.toFixed(3));
    }
    // Parallax sutil del nombre en el hero
    if (heroName && !reduceMotion && y < innerHeight) {
      heroName.style.transform = `translateY(${y * 0.18}px)`;
      heroName.style.opacity = String(1 - y / innerHeight * 0.8);
    }
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  // Sección activa en el menú
  const links = $$('.nav a[href^="#"]');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => (a.getAttribute('href') === `#${en.target.id}`
        ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));

  // Menú móvil
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  if (!burger || !menu) return;

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('open'));
      $('a', menu)?.focus({ preventScroll: true });
    } else {
      menu.classList.remove('open');
      setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 600);
    }
  }
  burger.addEventListener('click', () => { Sound.play('click'); setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => e.matches && setMenu(false));
})();

/* ============================================================
   REVEAL AL HACER SCROLL (con escalonado entre hermanos)
   ============================================================ */
(function initReveal() {
  const els = $$('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

  els.forEach((el) => {
    const sibs = $$(':scope > .reveal', el.parentElement);
    const i = sibs.indexOf(el);
    if (sibs.length > 1 && i > 0) el.style.setProperty('--d', `${Math.min(i, 6) * 0.08}s`);
    io.observe(el);
  });
  $$('.tl-step').forEach((el) => io.observe(el));
})();

/* ============================================================
   CONTADORES
   ============================================================ */
(function initCounters() {
  const nums = $$('[data-count]');
  if (!nums.length || reduceMotion) return;
  nums.forEach((el) => { el.textContent = '0'; });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = Number(el.dataset.count);
      const t0 = performance.now();
      const dur = 1400;
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  nums.forEach((el) => io.observe(el));
})();

/* ============================================================
   HERO — timecode del visor y pausa del video fuera de pantalla
   ============================================================ */
(function initViewfinder() {
  const vf = $('#viewfinder');
  const video = $('.viewfinder-video', vf || document);
  const tc = $('#heroTC');
  if (!vf || !video) return;

  if (reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }

  const pad = (n) => String(n).padStart(2, '0');
  let visible = true;
  const start = performance.now();
  (function loop(now) {
    if (visible && tc) {
      const f = Math.floor((now - start) / (1000 / 24));
      tc.textContent = `${pad(Math.floor(f / 86400))}:${pad(Math.floor(f / 1440) % 60)}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;
    }
    requestAnimationFrame(loop);
  })(start);

  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (reduceMotion) return;
    if (visible) video.play().catch(() => {}); else video.pause();
  }).observe(vf);
})();

/* ============================================================
   ESPECIALIDADES — foco de luz que sigue al cursor
   ============================================================ */
(function initRoleLight() {
  if (!finePointer) return;
  $$('.role').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
})();

/* ============================================================
   TRABAJO + REPRODUCTOR
   Previews ligeros (media/previews) en hover; video completo con audio en <dialog>.
   ============================================================ */
(function initWork() {
  const cards = $$('.work-card[data-video]');
  const dialog = $('#player');
  const video = $('#playerVideo');
  if (!cards.length || !dialog || !video) return;

  // Preview en hover: el src se asigna solo la primera vez (preload="none")
  if (finePointer && !reduceMotion) {
    cards.forEach((card) => {
      const pv = $('video', card);
      card.addEventListener('pointerenter', () => {
        if (!pv.src) pv.src = pv.dataset.src;
        pv.play().then(() => card.classList.add('is-previewing')).catch(() => {});
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-previewing');
        pv.pause();
      });
    });
  }

  let index = 0;
  const title = $('#playerTitle');
  const count = $('#playerCount');

  function load(i) {
    index = (i + cards.length) % cards.length;
    const card = cards[index];
    video.src = card.dataset.video;
    video.poster = $('img', card).getAttribute('src');
    title.textContent = card.dataset.title;
    count.textContent = `${String(index + 1).padStart(2, '0')}/${String(cards.length).padStart(2, '0')}`;
    video.play().catch(() => {});
  }

  function open(i) {
    Sound.play('clap');
    Sound.duck(true);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    load(i);
  }

  cards.forEach((card, i) => {
    card.setAttribute('aria-label', `Reproducir ${card.dataset.title}`);
    card.addEventListener('click', () => open(i));
  });

  $('#playerPrev').addEventListener('click', () => load(index - 1));
  $('#playerNext').addEventListener('click', () => load(index + 1));
  $('#playerClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') load(index + 1);
    if (e.key === 'ArrowLeft') load(index - 1);
  });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load(); // cancela la descarga pendiente
    document.body.style.overflow = '';
    Sound.duck(false);
  });
})();

/* ============================================================
   MARQUEE DE CLIENTES — duplica la pista para un loop continuo
   ============================================================ */
(function initMarquee() {
  const track = $('.marquee-track');
  if (!track || reduceMotion) return;
  track.innerHTML += track.innerHTML;
})();

/* ============================================================
   RELOJ (hora de Bucaramanga) y año
   ============================================================ */
(function initClock() {
  const clocks = $$('[data-clock]');
  const fmt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' });
  const tick = () => clocks.forEach((c) => { c.textContent = fmt.format(new Date()); });
  tick();
  setInterval(tick, 15000);
  $$('[data-year]').forEach((y) => { y.textContent = new Date().getFullYear(); });
})();
