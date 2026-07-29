import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const optionalIssuerFields = [
  ['procuracao-veiculo.html', 'orgao'],
  ['procuracao-particular.html', 'outorganteOrgao'],
];

for (const [file, fieldName] of optionalIssuerFields) {
  test(`${fieldName} is optional in ${file}`, async () => {
    const html = await readFile(file, 'utf8');
    const input = html.match(new RegExp(`<input[^>]*name="${fieldName}"[^>]*>`))?.[0];

    assert.ok(input, `Campo ${fieldName} não encontrado`);
    assert.doesNotMatch(input, /\brequired\b/);
  });
}

test('ATPV-e requests only relevant identification and vehicle fields', async () => {
  const html = await readFile('procuracao-intencao-venda.html', 'utf8');

  assert.doesNotMatch(html, /name="estadoCivil"/);
  assert.doesNotMatch(html, /name="identidadeVendedor"/);
  assert.doesNotMatch(html, /name="orgaoVendedor"/);
  assert.doesNotMatch(html, /name="identidadeComprador"/);
  assert.match(html, /<input[^>]*name="cor"[^>]*required[^>]*>/);
});

test('ATPV-e fills the complete address from the postal code', async () => {
  const script = await readFile('intencao-venda.js', 'utf8');

  assert.match(script, /neighborhood\.value = result\.bairro/);
  assert.match(script, /includeNeighborhoodInAddress && result\.bairro/);
  assert.match(script, /neighborhood: intencaoVendaForm\.elements\.bairroVendedor/);
  assert.match(script, /includeNeighborhoodInAddress: true/);
});

test('vehicle power of attorney allows a new vehicle without a license plate', async () => {
  const [html, experience, script] = await Promise.all([
    readFile('procuracao-veiculo.html', 'utf8'),
    readFile('form-experience.js', 'utf8'),
    readFile('procuracao.js', 'utf8'),
  ]);
  const plateInput = html.match(/<input[^>]*name="placa"[^>]*>/)?.[0];

  assert.ok(plateInput, 'Campo placa não encontrado');
  assert.doesNotMatch(plateInput, /\brequired\b/);
  assert.match(plateInput, /\bdata-warning-empty=/);
  assert.match(experience, /premium-field-warning/);
  assert.match(script, /veículo novo, ainda sem placa/);
});
