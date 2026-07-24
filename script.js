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

const heroTyping = document.querySelector('[data-hero-typing]');

if (heroTyping && !reduceMotion) {
  const messages = ['Sua vida mais leve.', 'Seu tempo mais livre.', 'Seu caminho mais simples.'];
  let messageIndex = 0;
  let characterIndex = messages[messageIndex].length;
  let erasing = false;

  const updateHeroTyping = () => {
    const message = messages[messageIndex];
    heroTyping.textContent = message.slice(0, characterIndex);

    let delay = erasing ? 42 : 68;

    if (!erasing && characterIndex === message.length) {
      erasing = true;
      delay = 2200;
    } else if (erasing && characterIndex === 0) {
      erasing = false;
      messageIndex = (messageIndex + 1) % messages.length;
      delay = 380;
    }

    characterIndex += erasing ? -1 : 1;
    window.setTimeout(updateHeroTyping, delay);
  };

  window.setTimeout(updateHeroTyping, 1300);
}

const heroPhoto = document.querySelector('.hero-photo');

if (heroPhoto && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
  heroPhoto.addEventListener('pointermove', (event) => {
    const bounds = heroPhoto.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroPhoto.style.setProperty('--photo-tilt-x', `${(-y * 3).toFixed(2)}deg`);
    heroPhoto.style.setProperty('--photo-tilt-y', `${(x * 3).toFixed(2)}deg`);
  });

  heroPhoto.addEventListener('pointerleave', () => {
    heroPhoto.style.setProperty('--photo-tilt-x', '0deg');
    heroPhoto.style.setProperty('--photo-tilt-y', '0deg');
  });
}

window.MEGA_DECLARATION_CSS = `
  .mega-declaration { width: 100%; margin: 8px auto 0; border: 1px solid #555; padding: 8px 14px 7px; text-align: center; font-size: 8pt; line-height: 1.22; break-inside: avoid; }
  .mega-declaration h2 { margin: 0 0 7px; font-size: 10pt; }
  .mega-declaration p { margin: 0; text-align: center; }
  .mega-declaration strong { display: block; margin-top: 4px; }
  .mega-declaration-signature { position: relative; width: 90mm; height: 26mm; margin: 3px auto 4px; overflow: hidden; border-bottom: 1px solid #222; }
  .mega-declaration-signature img { position: absolute; top: -10.4mm; left: 50%; width: 74mm; height: auto; transform: translateX(-50%); }
  .mega-declaration-name { font-size: 9pt; font-weight: 700; }
`;

window.renderMegaDeclaration = (city, date) => `
  <section class="mega-declaration">
    <h2>DECLARAÇÃO</h2>
    <p>Declaramos, sob a pena da lei, que a assinatura aposta na Procuração é de próprio punho do outorgante, feita em nossa presença, onde desde já assumimos a responsabilidade civil e criminal.</p>
    <strong>${city}, ${date}</strong>
    <div class="mega-declaration-signature">
      <img src="${new URL('assets/assinatura-sergio.png', window.location.href).href}" alt="Assinatura do responsável da MEGA Despachante">
    </div>
    <div class="mega-declaration-name">DESPACHANTE MEGA</div>
  </section>
`;
