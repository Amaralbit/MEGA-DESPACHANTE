const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');

document.getElementById('year').textContent = new Date().getFullYear();

const updateScrollEffects = () => {
  header.classList.toggle('scrolled', window.scrollY > 6);
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? Math.min(window.scrollY / scrollableHeight, 1) : 0;
  document.documentElement.style.setProperty('--scroll-progress', progress);
};

window.addEventListener('scroll', updateScrollEffects, { passive: true });
updateScrollEffects();

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});

nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Abrir menu');
}));

const contactForm = document.getElementById('contact-form');

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = data.get('assunto');
  const body = `Nome: ${data.get('nome')}\nE-mail: ${data.get('email')}\n\nMensagem:\n${data.get('mensagem')}`;
  window.location.href = `mailto:Atendimento@megadetran.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

const revealItems = [...document.querySelectorAll('[data-reveal]')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (revealItems.length && !reduceMotion && 'IntersectionObserver' in window) {
  document.body.classList.add('motion-ready');

  revealItems.forEach((item) => item.style.setProperty('--reveal-delay', '0ms'));
  document.querySelectorAll('.service-card[data-reveal]').forEach((card, index) => {
    card.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
  });

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -46px' });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
