import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin, prepareSignedHtml } from '../api/generate-pdf.mjs';

const validHtml = (title) => `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="UTF-8"><title>${title}</title></head>
  <body>
    <button class="print-hint" onclick="window.print()">Imprimir</button>
    <img class="logo-symbol" src="assets/logo-mega-transparent.png" alt="Logo">
    <article><!--MEGA_PROTECTED_SIGNATURE--></article>
  </body>
</html>`;

test('injeta a assinatura e remove o botão de impressão', () => {
  const result = prepareSignedHtml({
    html: validHtml('Procuração para veículo'),
    documentType: 'procuracao-veiculo',
    signatureUrl: 'https://example.com/assinatura.png',
  });
  assert.match(result.html, /https:\/\/example\.com\/assinatura\.png/);
  assert.doesNotMatch(result.html, /print-hint/);
  assert.doesNotMatch(result.html, /onclick/);
  assert.equal(result.fileName, 'procuracao-veiculo.pdf');
});

test('rejeita documento que não corresponde ao tipo informado', () => {
  assert.throws(
    () => prepareSignedHtml({
      html: validHtml('Declaração de residência'),
      documentType: 'procuracao-veiculo',
    }),
    /não corresponde/,
  );
});

test('rejeita scripts e mais de uma área de assinatura', () => {
  assert.throws(
    () => prepareSignedHtml({
      html: validHtml('Procuração para veículo').replace(
        '</body>',
        '<script>alert(1)</script><!--MEGA_PROTECTED_SIGNATURE--></body>',
      ),
      documentType: 'procuracao-veiculo',
    }),
    /assinatura protegida|elementos não permitidos/,
  );
});

test('aceita o site oficial e ambientes locais, mas rejeita sites externos', () => {
  assert.equal(isAllowedOrigin('https://amaralbit.github.io'), true);
  assert.equal(isAllowedOrigin('http://localhost:5500'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:8080'), true);
  assert.equal(isAllowedOrigin('null'), true);
  assert.equal(isAllowedOrigin('https://site-nao-autorizado.example'), false);
});
