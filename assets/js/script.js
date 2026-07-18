// ===================== Theme toggle =====================
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme') || getSystemTheme();
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = root.getAttribute('data-theme') || getSystemTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ===================== Mobile nav =====================
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

document.querySelectorAll('[data-nav]').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// ===================== Header scroll state + progress bar =====================
const siteHeader = document.getElementById('siteHeader');
const progressBar = document.getElementById('progressBar');

function onScroll() {
  const scrollY = window.scrollY;
  siteHeader.classList.toggle('scrolled', scrollY > 12);

  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
  progressBar.style.width = progress + '%';

  toTopBtn.style.opacity = scrollY > 500 ? '1' : '0';
  toTopBtn.style.pointerEvents = scrollY > 500 ? 'auto' : 'none';
}

window.addEventListener('scroll', onScroll, { passive: true });

// ===================== Active nav link on scroll =====================
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-link');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('href') === '#' + id);
      });
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });

sections.forEach(sec => navObserver.observe(sec));

// ===================== Reveal on scroll =====================
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = (i % 4) * 60 + 'ms';
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach(el => revealObserver.observe(el));

// ===================== Typewriter =====================
const roles = ['Harita Mühendisi', 'CBS Uzmanı', 'Veri Analisti', 'Python Geliştiricisi'];
const typewriterEl = document.getElementById('typewriter');
let roleIndex = 0, charIndex = 0, deleting = false;

function typeLoop() {
  const current = roles[roleIndex];

  if (!deleting) {
    charIndex++;
    typewriterEl.textContent = current.slice(0, charIndex);
    if (charIndex === current.length) {
      deleting = true;
      setTimeout(typeLoop, 1600);
      return;
    }
  } else {
    charIndex--;
    typewriterEl.textContent = current.slice(0, charIndex);
    if (charIndex === 0) {
      deleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
    }
  }
  setTimeout(typeLoop, deleting ? 45 : 85);
}
typeLoop();

// ===================== Back to top =====================
const toTopBtn = document.getElementById('toTop');
toTopBtn.style.opacity = '0';
toTopBtn.style.pointerEvents = 'none';
toTopBtn.style.transition = 'opacity 0.25s ease';

toTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===================== Footer year =====================
document.getElementById('year').textContent = new Date().getFullYear();
