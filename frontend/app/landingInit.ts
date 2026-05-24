/**
 * Landing page initialization logic.
 * Provides init/cleanup functions for use in React useEffect.
 */

const rebotAnimationUrl = '/assets/rebot-animation.json';

let glightboxInstance = null;
let lottieInstance = null;

// --- Event handler references for cleanup ---
let scrollHandler = null;
let scrollTopClickHandler = null;

/**
 * Initialize all landing page interactive features.
 * Call this inside useEffect after the component mounts.
 * @param {HTMLElement} rootEl - The root .landing-page element
 */
export async function initLanding(rootEl) {
  if (!rootEl || typeof window === 'undefined') return;

  const [{ default: AOS }, { default: GLightbox }, { default: PureCounter }] = await Promise.all([
    import('aos'),
    import('glightbox'),
    import('@srexi/purecounterjs'),
  ]);

  // ----- AOS (Animate On Scroll) -----
  AOS.init({
    duration: 600,
    easing: 'ease-in-out',
    once: true,
    mirror: false,
  });

  // ----- GLightbox -----
  glightboxInstance = GLightbox({ selector: '.glightbox' });

  // ----- PureCounter -----
  new PureCounter();

  // ----- Lottie Animation -----
  const animContainer = rootEl.querySelector('#rebot-animation');
  if (animContainer) {
    const lottie = await import('lottie-web');
    lottieInstance = lottie.default.loadAnimation({
      container: animContainer,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: rebotAnimationUrl,
    });
  }

  // ----- Scroll: add .scrolled class to root -----
  function toggleScrolled() {
    const header = rootEl.querySelector('#header');
    if (!header) return;
    if (
      !header.classList.contains('scroll-up-sticky') &&
      !header.classList.contains('sticky-top') &&
      !header.classList.contains('fixed-top')
    )
      return;
    window.scrollY > 100
      ? rootEl.classList.add('scrolled')
      : rootEl.classList.remove('scrolled');
  }

  scrollHandler = () => {
    toggleScrolled();
    toggleScrollTop();
    navmenuScrollspy();
  };

  document.addEventListener('scroll', scrollHandler);
  toggleScrolled(); // initial check

  // ----- Scroll-to-top button -----
  const scrollTopBtn = rootEl.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTopBtn) {
      window.scrollY > 100
        ? scrollTopBtn.classList.add('active')
        : scrollTopBtn.classList.remove('active');
    }
  }

  if (scrollTopBtn) {
    scrollTopClickHandler = (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    scrollTopBtn.addEventListener('click', scrollTopClickHandler);
  }

  toggleScrollTop(); // initial check

  // ----- Mobile nav toggle -----
  const mobileNavToggleBtn = rootEl.querySelector('.mobile-nav-toggle');
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', () => {
      rootEl.classList.toggle('mobile-nav-active');
      mobileNavToggleBtn.classList.toggle('bi-list');
      mobileNavToggleBtn.classList.toggle('bi-x');
    });
  }

  // Hide mobile nav on same-page/hash links
  rootEl.querySelectorAll('#navmenu a').forEach((link) => {
    link.addEventListener('click', () => {
      if (rootEl.classList.contains('mobile-nav-active')) {
        rootEl.classList.remove('mobile-nav-active');
        if (mobileNavToggleBtn) {
          mobileNavToggleBtn.classList.add('bi-list');
          mobileNavToggleBtn.classList.remove('bi-x');
        }
      }
    });
  });

  // ----- FAQ accordion -----
  rootEl.querySelectorAll('.faq-item h3, .faq-item .faq-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      el.parentNode.classList.toggle('faq-active');
    });
  });

  // ----- Navmenu scrollspy -----
  const navmenulinks = rootEl.querySelectorAll('.navmenu a');

  function navmenuScrollspy() {
    navmenulinks.forEach((link) => {
      if (!link.hash) return;
      const section = document.querySelector(link.hash);
      if (!section) return;
      const position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= section.offsetTop + section.offsetHeight) {
        rootEl.querySelectorAll('.navmenu a.active').forEach((a) => a.classList.remove('active'));
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  navmenuScrollspy(); // initial check

  // ----- Preloader -----
  const preloader = rootEl.querySelector('#preloader');
  if (preloader) {
    preloader.remove();
  }
}

/**
 * Cleanup all landing page event listeners and instances.
 * Call this in the useEffect cleanup function.
 */
export function cleanupLanding() {
  if (scrollHandler) {
    document.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  if (glightboxInstance) {
    glightboxInstance.destroy();
    glightboxInstance = null;
  }

  if (lottieInstance) {
    lottieInstance.destroy();
    lottieInstance = null;
  }

  scrollTopClickHandler = null;
}
