import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const signatureSpacingByDocument = [
  ['procuracao.js', /\.signature-line \{[^}]*margin: 45px auto 5px;/],
  ['intencao-venda.js', /\.signature p \{[^}]*margin-bottom: 40px;/],
  ['procuracao-particular.js', /\.place-date \{ margin: 4px 0 40px; \}/],
  ['declaracao-residencia.js', /\.signature \.place-date \{[^}]*margin-bottom: 35mm;/],
  ['requerimento-alteracao-caracteristica.js', /\.date \{ margin: 10px 0 43px;/],
  ['requerimento-regravacao-chassi.js', /\.date \{ margin: 10px 0 43px;/],
  ['averbacao-cancelamento-impedimento.js', /\.date \{ margin: 12px 0 43px;/],
  ['declaracao-procedencia-motor.js', /\.date \{ margin: 4px 0 34px;/],
  ['requerimento-segunda-via.js', /\.place-date \{ margin: 3px 0 38px;/],
];

test('all PDF forms leave enough room for a handwritten signature', async () => {
  assert.equal(signatureSpacingByDocument.length, 9);

  for (const [file, spacingPattern] of signatureSpacingByDocument) {
    const script = await readFile(file, 'utf8');
    assert.match(script, spacingPattern, `${file} sem o espaçamento de assinatura esperado`);
  }
});
