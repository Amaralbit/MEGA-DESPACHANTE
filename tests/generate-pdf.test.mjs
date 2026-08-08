import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
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
  assert.match(result.html, /logo-mega-pdf\.png/);
  assert.doesNotMatch(result.html, /logo-mega-transparent\.png/);
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

test('usa os ativos otimizados por padrão na geração do PDF', () => {
  const result = prepareSignedHtml({
    html: validHtml('Procuração para veículo'),
    documentType: 'procuracao-veiculo',
  });
  assert.match(result.html, /assinatura-sergio-pdf\.png/);
  assert.match(result.html, /logo-mega-pdf\.png/);
  assert.doesNotMatch(result.html, /assinatura-sergio\.png/);
  assert.doesNotMatch(result.html, /logo-mega-transparent\.png/);
});

test('autoriza e prepara a procuração de intenção de venda', () => {
  const result = prepareSignedHtml({
    html: validHtml('Procuração - Intenção de venda'),
    documentType: 'procuracao-intencao-venda',
  });

  assert.equal(result.fileName, 'procuracao-intencao-venda.pdf');
  assert.match(result.html, /assinatura-sergio-pdf\.png/);
});

test('mantém os ativos de impressão abaixo de 100 KB cada', async () => {
  const signature = await stat('assets/assinatura-sergio-pdf.png');
  const logo = await stat('assets/logo-mega-pdf.png');
  assert.ok(signature.size < 100_000);
  assert.ok(logo.size < 100_000);
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
  assert.equal(isAllowedOrigin('https://mega-despachante-seguro.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://mega-despachante.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://megadespachante.com.br'), true);
  assert.equal(isAllowedOrigin('https://www.megadespachante.com.br'), true);
  assert.equal(isAllowedOrigin('http://localhost:5500'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:8080'), true);
  assert.equal(isAllowedOrigin('null'), true);
  assert.equal(isAllowedOrigin('https://site-nao-autorizado.example'), false);
});
