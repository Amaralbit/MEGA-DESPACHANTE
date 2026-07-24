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
      <!--MEGA_PROTECTED_SIGNATURE-->
    </div>
    <div class="mega-declaration-name">DESPACHANTE MEGA</div>
  </section>
`;

const protectedPdfApiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/generate-pdf'
  : 'https://mega-despachante-seguro.vercel.app/api/generate-pdf';

const protectedPdfState = {
  resolver: null,
  busy: false,
};

const ensureProtectedPdfDialog = () => {
  let dialog = document.getElementById('protected-pdf-dialog');
  if (dialog) return dialog;

  dialog = document.createElement('div');
  dialog.id = 'protected-pdf-dialog';
  dialog.className = 'protected-pdf-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="protected-pdf-backdrop"></div>
    <section class="protected-pdf-card" role="dialog" aria-modal="true" aria-labelledby="protected-pdf-title">
      <button class="protected-pdf-close" type="button" aria-label="Cancelar geração do PDF">×</button>
      <span class="protected-pdf-kicker">Documento protegido</span>
      <h2 id="protected-pdf-title">Autorizar assinatura</h2>
      <p>Informe a senha da MEGA para gerar este PDF com a assinatura do responsável.</p>
      <form class="protected-pdf-form">
        <label for="protected-pdf-password">Senha de autorização</label>
        <div class="protected-pdf-input-wrap">
          <input id="protected-pdf-password" name="password" type="password" autocomplete="current-password" required>
          <button class="protected-pdf-toggle" type="button" aria-label="Mostrar senha">Mostrar</button>
        </div>
        <p class="protected-pdf-error" role="alert" aria-live="polite"></p>
        <button class="protected-pdf-submit" type="submit">
          <span>Gerar PDF assinado</span>
          <span class="protected-pdf-spinner" aria-hidden="true"></span>
        </button>
      </form>
    </section>
  `;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('.protected-pdf-form');
  const passwordInput = dialog.querySelector('#protected-pdf-password');
  const error = dialog.querySelector('.protected-pdf-error');
  const toggle = dialog.querySelector('.protected-pdf-toggle');

  const close = (value = null) => {
    if (protectedPdfState.busy) return;
    dialog.hidden = true;
    document.body.classList.remove('protected-pdf-open');
    passwordInput.value = '';
    passwordInput.type = 'password';
    toggle.textContent = 'Mostrar';
    toggle.setAttribute('aria-label', 'Mostrar senha');
    error.textContent = '';
    protectedPdfState.resolver?.(value);
    protectedPdfState.resolver = null;
  };

  dialog.querySelector('.protected-pdf-close').addEventListener('click', () => close());
  dialog.querySelector('.protected-pdf-backdrop').addEventListener('click', () => close());
  toggle.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Mostrar' : 'Ocultar';
    toggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    passwordInput.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    if (!password) {
      error.textContent = 'Digite a senha para continuar.';
      passwordInput.focus();
      return;
    }
    protectedPdfState.resolver?.(password);
    protectedPdfState.resolver = null;
  });

  return dialog;
};

const requestProtectedPdfPassword = (message = '') => {
  const dialog = ensureProtectedPdfDialog();
  const passwordInput = dialog.querySelector('#protected-pdf-password');
  const error = dialog.querySelector('.protected-pdf-error');
  error.textContent = message;
  dialog.hidden = false;
  document.body.classList.add('protected-pdf-open');
  window.setTimeout(() => passwordInput.focus(), 20);
  return new Promise((resolve) => {
    protectedPdfState.resolver = resolve;
  });
};

const setProtectedPdfBusy = (busy) => {
  const dialog = ensureProtectedPdfDialog();
  protectedPdfState.busy = busy;
  dialog.classList.toggle('is-loading', busy);
  dialog.querySelector('#protected-pdf-password').disabled = busy;
  dialog.querySelector('.protected-pdf-toggle').disabled = busy;
  dialog.querySelector('.protected-pdf-close').disabled = busy;
  dialog.querySelector('.protected-pdf-submit').disabled = busy;
};

const closeProtectedPdfDialog = () => {
  const dialog = ensureProtectedPdfDialog();
  dialog.hidden = true;
  document.body.classList.remove('protected-pdf-open');
  const passwordInput = dialog.querySelector('#protected-pdf-password');
  passwordInput.value = '';
  passwordInput.type = 'password';
  dialog.querySelector('.protected-pdf-toggle').textContent = 'Mostrar';
  dialog.querySelector('.protected-pdf-error').textContent = '';
  setProtectedPdfBusy(false);
};

const protectedPdfErrorMessage = (status, fallback) => {
  if (status === 401) return 'Senha incorreta. Confira e tente novamente.';
  if (status === 429) return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  if (status === 503) return 'O gerador seguro ainda não foi configurado. Fale com o responsável pelo site.';
  return fallback || 'Não foi possível gerar o PDF agora. Tente novamente.';
};

const generateProtectedPdf = async ({ html, documentType, fileName }) => {
  const dialog = ensureProtectedPdfDialog();
  const error = dialog.querySelector('.protected-pdf-error');
  let feedback = '';

  while (true) {
    const password = await requestProtectedPdfPassword(feedback);
    if (!password) return;

    setProtectedPdfBusy(true);
    error.textContent = '';

    try {
      const response = await fetch(protectedPdfApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, html, documentType }),
      });

      if (!response.ok) {
        let message = '';
        try {
          const payload = await response.json();
          message = payload.error;
        } catch {
          message = '';
        }
        throw Object.assign(new Error(protectedPdfErrorMessage(response.status, message)), { status: response.status });
      }

      const pdf = await response.blob();
      const url = URL.createObjectURL(pdf);
      const download = document.createElement('a');
      download.href = url;
      download.download = fileName;
      document.body.appendChild(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      closeProtectedPdfDialog();
      return;
    } catch (generationError) {
      setProtectedPdfBusy(false);
      feedback = generationError instanceof TypeError && generationError.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao gerador seguro. Atualize a página e tente novamente.'
        : generationError.message;
      dialog.querySelector('#protected-pdf-password').select();
    }
  }
};

window.createProtectedPdfPreview = (documentType, fileName) => {
  let html = '';
  return {
    document: {
      open() {
        html = '';
      },
      write(chunk) {
        html += chunk;
      },
      close() {
        void generateProtectedPdf({ html, documentType, fileName });
      },
    },
    focus() {},
    print() {},
  };
};
