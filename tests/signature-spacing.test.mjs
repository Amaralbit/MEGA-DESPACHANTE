import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const signatureSpacingByDocument = [
  ['procuracao.js', /\.signature-line \{[^}]*margin: 40px auto 5px;/],
  ['intencao-venda.js', /\.signature p \{[^}]*margin-bottom: 94px;/],
  ['procuracao-particular.js', /\.place-date \{ margin: 1px 0 94px; \}/],
  ['declaracao-residencia.js', /\.signature \.place-date \{[^}]*margin-bottom: 26mm;/],
  ['requerimento-alteracao-caracteristica.js', /\.date \{ margin: 3px 0 100px;/],
  ['requerimento-regravacao-chassi.js', /\.date \{ margin: 3px 0 100px;/],
  ['averbacao-cancelamento-impedimento.js', /\.date \{ margin: 5px 0 100px;/],
  ['declaracao-procedencia-motor.js', /\.date \{ margin: 0 0 82px;/],
  ['requerimento-segunda-via.js', /\.place-date \{ margin: 0 0 90px;/],
];

test('all PDF forms leave enough room for a handwritten signature', async () => {
  assert.equal(signatureSpacingByDocument.length, 9);

  for (const [file, spacingPattern] of signatureSpacingByDocument) {
    const script = await readFile(file, 'utf8');
    assert.match(script, spacingPattern, `${file} sem o espaçamento de assinatura esperado`);
  }
});

test('the MEGA stamp keeps its spacing in documents that still use it', async () => {
  const sharedStyles = await readFile('script.js', 'utf8');

  assert.match(sharedStyles, /\.mega-declaration \{[^}]*margin: 16px auto 0;/);
});

test('all forms pin the signer at the bottom of the document', async () => {
  const documents = signatureSpacingByDocument.map(([file]) => file);
  assert.equal(documents.length, 9);

  for (const file of documents) {
    const script = await readFile(file, 'utf8');
    assert.match(script, /class="[^"]*\bsignature-footer\b[^"]*"/, `${file} sem o rodapé fixo de assinaturas`);
  }

  const sharedStyles = await readFile('script.js', 'utf8');
  const particularPowerOfAttorney = await readFile('procuracao-particular.js', 'utf8');
  assert.match(sharedStyles, /\.document \{ display: flex; flex-direction: column; \}/);
  assert.match(sharedStyles, /\.signature-footer \{ margin-top: auto;/);
  assert.match(particularPowerOfAttorney, /\.signature-footer \{ margin-top: auto;/);
});

test('particular power of attorney omits the MEGA stamp only', async () => {
  const particularPowerOfAttorney = await readFile('procuracao-particular.js', 'utf8');

  assert.doesNotMatch(particularPowerOfAttorney, /carimbo-mega-assinado|mega-stamp/);
  assert.match(particularPowerOfAttorney, /Assinatura do\(a\) Outorgante/);
});

test('residence declaration keeps long addresses and signatures on one A4 page', async () => {
  const residenceDeclaration = await readFile('declaracao-residencia.js', 'utf8');

  assert.match(residenceDeclaration, /\.declaration \{[^}]*overflow-wrap: anywhere;/);
  assert.match(residenceDeclaration, /\.signature \{[^}]*margin: 12mm auto 0;/);
  assert.match(residenceDeclaration, /\.signature \.place-date \{[^}]*margin-bottom: 26mm;/);
});

test('residence declaration keeps the place and date joined together', async () => {
  const residenceDeclaration = await readFile('declaracao-residencia.js', 'utf8');

  assert.match(residenceDeclaration, /\.signature \.place-date \{[^}]*display: inline-flex;/);
  assert.match(residenceDeclaration, /\.signature \.place-date \{[^}]*justify-content: flex-start;/);
});

test('vehicle power of attorney lifts the grantor signature above the fixed MEGA box', async () => {
  const vehiclePowerOfAttorney = await readFile('procuracao.js', 'utf8');

  assert.match(vehiclePowerOfAttorney, /class="signature-footer vehicle-signature-footer"/);
  assert.match(vehiclePowerOfAttorney, /\.vehicle-signature-footer \.signature \{ margin-bottom: 224px; \}/);
});
