import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const premiumForms = [
  ['averbacao-cancelamento-impedimento.html', 'averbacao-cancelamento-impedimento.js'],
  ['declaracao-procedencia-motor.html', 'declaracao-procedencia-motor.js'],
  ['declaracao-residencia.html', 'declaracao-residencia.js'],
  ['procuracao-intencao-venda.html', 'intencao-venda.js'],
  ['procuracao-particular.html', 'procuracao-particular.js'],
  ['procuracao-veiculo.html', 'procuracao.js'],
  ['requerimento-alteracao-caracteristica.html', 'requerimento-alteracao-caracteristica.js'],
  ['requerimento-regravacao-chassi.html', 'requerimento-regravacao-chassi.js'],
  ['requerimento-segunda-via.html', 'requerimento-segunda-via.js'],
];

test('all digital document forms load the shared premium experience before their generator', async () => {
  assert.equal(premiumForms.length, 9);

  for (const [htmlFile, generatorFile] of premiumForms) {
    const html = await readFile(htmlFile, 'utf8');
    assert.match(html, /<form class="procuracao-form"/, `${htmlFile} sem o formulário digital esperado`);
    assert.ok((html.match(/class="form-intro"/g) || []).length >= 3, `${htmlFile} sem etapas suficientes`);

    const sharedScriptIndex = html.indexOf('src="form-experience.js"');
    const generatorScriptIndex = html.indexOf(`src="${generatorFile}"`);
    assert.ok(sharedScriptIndex > 0, `${htmlFile} não carrega form-experience.js`);
    assert.ok(generatorScriptIndex > sharedScriptIndex, `${htmlFile} deve carregar a experiência antes do gerador`);
  }
});

test('the shared form experience includes every premium workflow capability', async () => {
  const script = await readFile('form-experience.js', 'utf8');

  assert.match(script, /role="progressbar"/);
  assert.match(script, /mega-form-draft:v2:/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /setCustomValidity/);
  assert.match(script, /premium-review-modal/);
  assert.match(script, /Revise antes de gerar/);
  assert.match(script, /form\.requestSubmit/);
  assert.match(script, /mega:pdf-success/);
  assert.match(script, /Seu documento está pronto!/);
  assert.match(script, /Enviar documento para a MEGA/);
  assert.match(script, /navigator\.canShare/);
  assert.match(script, /https:\/\/wa\.me\//);
});

test('the protected download emits lifecycle events and keeps the PDF available for sharing', async () => {
  const script = await readFile('script.js', 'utf8');

  assert.match(script, /new CustomEvent\('mega:pdf-start'/);
  assert.match(script, /window\.MEGA_LAST_DOCUMENT = new File/);
  assert.match(script, /new CustomEvent\('mega:pdf-success'/);
  assert.match(script, /new CustomEvent\('mega:pdf-error'/);
});

test('the forms catalog announces the premium workflow', async () => {
  const html = await readFile('formularios.html', 'utf8');
  const styles = await readFile('styles.css', 'utf8');

  assert.match(html, /class="forms-premium-strip"/);
  assert.match(html, /Rascunho automático/);
  assert.match(html, /Revisão inteligente/);
  assert.match(html, /Envio para a MEGA/);
  assert.match(styles, /\.premium-progress\{/);
  assert.match(styles, /\.premium-field-invalid/);
  assert.match(styles, /\.premium-modal\[/);
  assert.match(styles, /\.premium-success-modal/);
});

test('the floating WhatsApp shortcut stays hidden while filling a form', async () => {
  const styles = await readFile('styles.css', 'utf8');

  assert.match(styles, /\.procura-page \.floating-whatsapp\s*\{\s*display:\s*none;/);
});
