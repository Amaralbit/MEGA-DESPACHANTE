const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');

document.getElementById('year').textContent = new Date().getFullYear();

window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 6));

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

document.getElementById('contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = data.get('assunto');
  const body = `Nome: ${data.get('nome')}\nE-mail: ${data.get('email')}\n\nMensagem:\n${data.get('mensagem')}`;
  window.location.href = `mailto:Atendimento@megadetran.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
