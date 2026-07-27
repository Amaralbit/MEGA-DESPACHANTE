import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const signatureSpacingByDocument = [
  ['procuracao.js', /\.signature-line \{[^}]*margin: 52px auto 5px;/],
  ['intencao-venda.js', /\.signature p \{[^}]*margin-bottom: 47px;/],
  ['procuracao-particular.js', /\.place-date \{ margin: 1px 0 47px; \}/],
  ['declaracao-residencia.js', /\.signature \.place-date \{[^}]*margin-bottom: 37mm;/],
  ['requerimento-alteracao-caracteristica.js', /\.date \{ margin: 3px 0 50px;/],
  ['requerimento-regravacao-chassi.js', /\.date \{ margin: 3px 0 50px;/],
  ['averbacao-cancelamento-impedimento.js', /\.date \{ margin: 5px 0 50px;/],
  ['declaracao-procedencia-motor.js', /\.date \{ margin: 0 0 41px;/],
  ['requerimento-segunda-via.js', /\.place-date \{ margin: 0 0 45px;/],
];

test('all PDF forms leave enough room for a handwritten signature', async () => {
  assert.equal(signatureSpacingByDocument.length, 9);

  for (const [file, spacingPattern] of signatureSpacingByDocument) {
    const script = await readFile(file, 'utf8');
    assert.match(script, spacingPattern, `${file} sem o espaçamento de assinatura esperado`);
  }
});
