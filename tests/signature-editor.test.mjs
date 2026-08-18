import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const powersOfAttorney = [
  ['procuracao-veiculo.html', 'procuracao.js', 'procuracao-veiculo'],
  ['procuracao-intencao-venda.html', 'intencao-venda.js', 'procuracao-intencao-venda'],
  ['procuracao-particular.html', 'procuracao-particular.js', 'procuracao-particular'],
];

test('every power of attorney loads the signature editor after the shared experience and before its generator', async () => {
  assert.equal(powersOfAttorney.length, 3);

  for (const [htmlFile, generatorFile] of powersOfAttorney) {
    const html = await readFile(htmlFile, 'utf8');
    const sharedScriptIndex = html.indexOf('src="form-experience.js"');
    const editorScriptIndex = html.indexOf('src="signature-editor.js"');
    const generatorScriptIndex = html.indexOf(`src="${generatorFile}"`);

    assert.ok(editorScriptIndex > sharedScriptIndex, `${htmlFile} deve carregar signature-editor.js depois de form-experience.js`);
    assert.ok(generatorScriptIndex > editorScriptIndex, `${htmlFile} deve carregar o gerador depois de signature-editor.js`);
    assert.match(html, /id="signature-editor-trigger"[^>]*disabled/, `${htmlFile} sem o botão do modo editor desabilitado por padrão`);
  }
});

test('every power of attorney generator marks the grantor signature as draggable and wires the editor button', async () => {
  for (const [, generatorFile, documentType] of powersOfAttorney) {
    const script = await readFile(generatorFile, 'utf8');

    assert.match(script, /data-drag-signature/, `${generatorFile} não marca a assinatura do outorgante como arrastável`);
    assert.match(script, /window\.MegaSignatureEditor\?\.attach\(/, `${generatorFile} não conecta o botão do modo editor`);
    assert.match(script, new RegExp(`documentType: '${documentType}'`), `${generatorFile} não informa o tipo de documento correto ao editor`);
  }
});

test('the editor button works without generating the unedited PDF first: it is wired outside the submit handler with a resolver that rebuilds the HTML from the current form data', async () => {
  for (const [, generatorFile] of powersOfAttorney) {
    const script = await readFile(generatorFile, 'utf8');

    const attachIndex = script.indexOf('MegaSignatureEditor?.attach(');
    const submitIndex = script.search(/addEventListener\('submit'/);
    assert.ok(attachIndex >= 0, `${generatorFile} não conecta o botão do modo editor`);
    assert.ok(submitIndex >= 0, `${generatorFile} sem handler de envio do formulário`);
    assert.ok(attachIndex < submitIndex, `${generatorFile} deve conectar o modo editor fora (antes) do handler de envio, para não depender de já ter gerado o PDF`);

    // O segundo argumento de attach() é uma função (chamada a cada clique),
    // não um objeto html estático montado apenas no envio do formulário.
    assert.match(script, /MegaSignatureEditor\?\.attach\([^,]+,\s*\(\)\s*=>\s*\{/, `${generatorFile} deve passar uma função resolvedora para attach(), reconstruída a cada clique`);
    assert.match(script, /megaValidateForEditor/, `${generatorFile} deve validar o formulário (com foco no campo problemático) antes de abrir o editor`);
  }
});

test('the vehicle and sale-intention power of attorney download the edited version automatically', async () => {
  const vehicle = await readFile('procuracao.js', 'utf8');
  const saleIntent = await readFile('intencao-venda.js', 'utf8');

  assert.match(vehicle, /mode: 'protected'/);
  assert.match(saleIntent, /mode: 'protected'/);
});

test('the particular power of attorney opens the edited version in a print window, like its original flow', async () => {
  const particular = await readFile('procuracao-particular.js', 'utf8');

  assert.match(particular, /mode: 'popup'/);
});

test('the signature editor module exposes an attach API that resolves a fresh config on every click and reuses the shared modal and protected download pipeline', async () => {
  const editor = await readFile('signature-editor.js', 'utf8');

  assert.match(editor, /window\.MegaSignatureEditor\s*=/);
  assert.match(editor, /attach\(button, resolveConfig\)/);
  assert.match(editor, /typeof resolveConfig === 'function'/, 'attach() deve chamar o resolvedor a cada clique, não usar um html estático capturado uma única vez');
  assert.match(editor, /window\.MegaModal/);
  assert.match(editor, /window\.downloadProtectedPdf/);
});

test('the shared modal helper, the protected download pipeline and the step-aware validator are exposed for reuse by the signature editor', async () => {
  const formExperience = await readFile('form-experience.js', 'utf8');
  const sharedScript = await readFile('script.js', 'utf8');

  assert.match(formExperience, /window\.MegaModal\s*=\s*\{\s*create:\s*createModal,\s*open:\s*openModal,\s*close:\s*closeModal\s*\}/);
  assert.match(formExperience, /form\.megaValidateForEditor\s*=/, 'form-experience.js deve expor uma validação por etapas reaproveitável pelo botão do modo editor');
  assert.match(sharedScript, /window\.downloadProtectedPdf\s*=/);
});

test('every power of attorney explains that the editor works before generating the PDF, not after', async () => {
  for (const [htmlFile] of powersOfAttorney) {
    const html = await readFile(htmlFile, 'utf8');

    assert.doesNotMatch(html, /Gere o PDF primeiro/, `${htmlFile} ainda diz que é preciso gerar o PDF antes de usar o modo editor`);
    assert.match(html, /class="signature-editor-hint"/, `${htmlFile} sem o texto de ajuda do modo editor`);
  }
});
