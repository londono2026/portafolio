/**
 * PORTFOLIO — Juan Londoño
 * main.js — Toda la lógica interactiva del sitio
 * Autor: Juan Londoño | Bucaramanga, Colombia
 */

/* ============================================================
   1. LOADER
   Elimina el overlay de carga después de la animación CSS
   ============================================================ */
(function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  // El CSS anima la salida en ~1.5s; luego eliminamos el nodo
  setTimeout(() => loader.remove(), 1600);
})();


/* ============================================================
   2. CURSOR PERSONALIZADO
   Punto rojo que sigue al mouse al instante;
   anillo que lo sigue con suavizado (lerp)
   ============================================================ */
(function initCursor() {
  const dot  = document.getElementById('curDot');
  const ring = document.getElementById('curRing');
  if (!dot || !ring) return;

  let mouseX = 0, mouseY = 0;   // posición real del mouse
  let ringX  = 0, ringY  = 0;   // posición suavizada del anillo

  // Seguimiento del mouse — el punto va exacto
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
  });

  // El anillo usa interpolación lineal (lerp) para suavizar
  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.transform = `translate(${ringX - 20}px, ${ringY - 20}px)`;
    requestAnimationFrame(animateRing);
  }

  animateRing();
})();


/* ============================================================
   3. NAVEGACIÓN
   Añade clase "scrolled" al nav cuando el usuario baja
   ============================================================ */
(function initNav() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();


/* ============================================================
   4. SCROLL REVEAL
   Activa la animación de entrada cuando el elemento
   es visible en el viewport (IntersectionObserver)
   ============================================================ */
(function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
        }
      });
    },
    { threshold: 0.12 }
  );

  elements.forEach((el) => observer.observe(el));
})();


/* ============================================================
   5. CONTADORES DE ESTADÍSTICAS
   Anima los números del 0 hasta su valor objetivo
   cuando la sección entra al viewport
   ============================================================ */
(function initCounters() {
  const statNumbers = document.querySelectorAll('.stat-n[data-target]');
  if (!statNumbers.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el     = entry.target;
        const target = Number(el.dataset.target);
        const step   = target / 60;  // ~60 frames para 1 segundo
        let current  = 0;

        const timer = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = Math.round(current);
          if (current >= target) clearInterval(timer);
        }, 16);  // aprox. 60fps

        observer.unobserve(el);  // ejecutar una sola vez
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach((el) => observer.observe(el));
})();


/* ============================================================
   6. SLIDER DE TESTIMONIOS
   Carrusel manual con auto-avance cada 5 segundos
   ============================================================ */
(function initTestimonials() {
  const track    = document.getElementById('testiTrack');
  const dotsWrap = document.getElementById('testiDots');
  const btnPrev  = document.getElementById('testiPrev');
  const btnNext  = document.getElementById('testiNext');

  if (!track || !dotsWrap || !btnPrev || !btnNext) return;

  const slides = track.querySelectorAll('.testi-slide');
  let current  = 0;
  let autoTimer;

  // Crear puntos de navegación
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = `tdot${i === 0 ? ' active' : ''}`;
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  function goTo(index) {
    current = index;
    track.style.transform = `translateX(-${index * 100}%)`;

    document.querySelectorAll('.tdot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  function goNext() {
    goTo((current + 1) % slides.length);
  }

  function goPrev() {
    goTo((current - 1 + slides.length) % slides.length);
  }

  // Reinicia el auto-avance al interactuar manualmente
  function resetAutoTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(goNext, 5000);
  }

  btnNext.addEventListener('click', () => { goNext(); resetAutoTimer(); });
  btnPrev.addEventListener('click', () => { goPrev(); resetAutoTimer(); });

  // Pausa al pasar el mouse
  track.addEventListener('mouseenter', () => clearInterval(autoTimer));
  track.addEventListener('mouseleave', () => { autoTimer = setInterval(goNext, 5000); });

  autoTimer = setInterval(goNext, 5000);
})();


/* ============================================================
   7. MODAL DE VIDEO
   Abre/cierra el elemento <video> con el archivo local indicado.

   Flujo:
   1. openModal(src) — asigna video.src y reproduce con audio
   2. closeModal()   — pausa, libera el recurso (src = '')
   3. Las tarjetas del portafolio (.work-item[data-video]):
      · Al hacer hover muestran el primer fotograma del video
        y lo reproducen en silencio como preview (estilo Netflix)
      · Al hacer clic abren el modal con audio y controles completos
   ============================================================ */
(function initModal() {
  const modal    = document.getElementById('vmodal');
  const video    = document.getElementById('vVideo');
  const btnPlay  = document.getElementById('srPlay');
  const btnClose = document.getElementById('modalClose');
  const modalBg  = document.getElementById('modalBg');

  if (!modal || !video) return;

  /**
   * Abre el modal y reproduce el video local indicado
   * @param {string} src — ruta relativa, ej: 'videos/showreel.mp4'
   */
  function openModal(src) {
    video.src = src;
    video.load();                  // ← fuerza al navegador a recargar el elemento
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Espera a que haya datos suficientes antes de reproducir
    // { once: true } evita que el listener se acumule entre aperturas
    video.addEventListener('canplay', () => {
      video.play().catch(() => {});
    }, { once: true });
  }

  function closeModal() {
    modal.classList.remove('open');
    video.pause();
    video.removeAttribute('src'); // limpia el src completamente
    video.load();                 // cancela cualquier descarga pendiente
    document.body.style.overflow = '';
  }

  // ── Showreel ──
  btnPlay?.addEventListener('click', () => openModal('videos/showreel.mp4'));

  // ── Tarjetas del portafolio ──
  document.querySelectorAll('.work-item[data-video]').forEach((item) => {
    const preview = item.querySelector('.video-preview');
    const src     = item.dataset.video;

    // ── Preview en hover (mudo, en loop) ──
    if (preview && src) {
      item.addEventListener('mouseenter', () => {
        // El src ya está en el HTML; solo hace falta reproducir
        preview.play().catch(() => {});
      });

      item.addEventListener('mouseleave', () => {
        preview.pause();
        // Vuelve al primer fotograma para que la portada se vea limpia
        preview.currentTime = 0;
      });
    }

    // ── Clic: abre modal con audio ──
    item.addEventListener('click', () => {
      if (src) openModal(src);
    });

    // ── Accesibilidad: Enter / Espacio ──
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (src) openModal(src);
      }
    });
  });

  // ── Cerrar modal ──
  btnClose?.addEventListener('click', closeModal);
  modalBg?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
})()


/* ============================================================
   8. FILTROS DEL PORTAFOLIO
   Solo efecto visual (activa clase "active" en el botón)
   ============================================================ */
(function initWorkFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      filterBtns.forEach((b) => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
})();


/* ============================================================
   9. PARALLAX DEL HERO
   Mueve la imagen de fondo al hacer scroll para efecto
   de profundidad (suave, no distrae)
   ============================================================ */
(function initHeroParallax() {
  const heroImg = document.querySelector('.hero-reel');
  if (!heroImg) return;

  function onScroll() {
    // Solo aplica parallax si el hero está visible
    if (window.scrollY < window.innerHeight) {
      heroImg.style.transform = `translateY(${window.scrollY * 0.25}px)`;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();


/* ============================================================
   10. FORMULARIO DE CONTACTO
   El formulario fue reemplazado por botones de WhatsApp.
   No se requiere lógica adicional.
   ============================================================ */