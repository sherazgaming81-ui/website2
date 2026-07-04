/* =========================================================
   K&N Packers and Movers — Interactive Behaviors
   ========================================================= */

// ============== Page Loading Animation ==============
(function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;

  // Respect reduced-motion users — instant fade out
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Minimum display time so the brand loader feels intentional (not a flash)
  const MIN_DURATION = prefersReduced ? 0 : 700;

  const hideLoader = () => {
    loader.classList.add('is-hidden');
    // Remove from DOM after fade-out completes
    setTimeout(() => loader.remove(), 700);
  };

  // Hide as soon as the page is fully loaded
  const startTime = performance.now();
  const onReady = () => {
    const elapsed = performance.now() - startTime;
    const remaining = Math.max(0, MIN_DURATION - elapsed);
    setTimeout(hideLoader, remaining);
  };

  if (document.readyState === 'complete') {
    onReady();
  } else {
    window.addEventListener('load', onReady, { once: true });
  }

  // Safety net — never show loader longer than 5 seconds
  setTimeout(hideLoader, 5000);
})();

// ============== Service Worker Registration ==============
(function registerServiceWorker() {
  // Only register if the browser supports service workers
  if (!('serviceWorker' in navigator)) return;

  // Wait until the page is fully loaded to avoid competing with critical resources
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.info('[K&N] Service worker registered · scope:', registration.scope);

        // Listen for SW updates
        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[K&N] New version available — auto-updating in background.');
            }
          });
        });

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SW_UPDATED') {
            console.info('[K&N] Service worker updated to', event.data.version);
          }
        });
      })
      .catch((err) => {
        console.warn('[K&N] Service worker registration failed:', err);
      });
  });
})();

// ============== Real-time Pakistan clock ==============
(function initClock(){
  const el = document.getElementById('tb-time');
  if (!el) return;
  function tick(){
    const now = new Date();
    // Convert to PKT (Asia/Karachi, UTC+5)
    const pkt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour12: false }));
    const hh = pkt.getHours().toString().padStart(2,'0');
    const mm = pkt.getMinutes().toString().padStart(2,'0');
    const ss = pkt.getSeconds().toString().padStart(2,'0');
    el.textContent = `${hh}:${mm}:${ss} PKT`;
  }
  tick();
  setInterval(tick, 1000);
})();

// ============== Mobile menu ==============
const menuBtn = document.getElementById('menuBtn');
const nav = document.getElementById('nav');
menuBtn?.addEventListener('click', () => {
  nav.classList.toggle('open');
  menuBtn.classList.toggle('open');
});
document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuBtn.classList.remove('open');
  });
});

// ============== Date input min = today ==============
document.querySelectorAll('input[type="date"]').forEach(input => {
  const today = new Date().toISOString().split('T')[0];
  input.min = today;
});

// ============== Smooth scroll with sticky-header offset ==============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#' || targetId.length < 2) return;
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      const headerOffset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ============== Reveal on scroll ==============
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.service-card, .step, .review, .why-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .6s ease, transform .6s ease';
  observer.observe(el);
});

// (Custom cursor removed — using normal system cursor)
