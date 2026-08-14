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

  assert.match(script, /bairro\.value = result\.bairro/);
  assert.match(script, /bairro: intencaoVendaForm\.elements\.bairroVendedor/);
  assert.match(script, /bairro: intencaoVendaForm\.elements\.bairroComprador/);
});

test('ATPV-e asks for the buyer postal code before the address, mirroring the seller layout', async () => {
  const html = await readFile('procuracao-intencao-venda.html', 'utf8');
  const postalCodePosition = html.indexOf('name="cepComprador"');
  const addressPosition = html.indexOf('name="enderecoComprador"');

  assert.ok(postalCodePosition >= 0, 'Campo CEP do comprador não encontrado');
  assert.ok(addressPosition >= 0, 'Campo endereço do comprador não encontrado');
  assert.ok(postalCodePosition < addressPosition, 'O CEP deve aparecer antes do endereço');
  assert.match(html, /name="numeroComprador"/);
  assert.match(html, /name="complementoComprador"/);
  assert.match(html, /name="quadraComprador"/);
  assert.match(html, /name="loteComprador"/);
  assert.match(html, /name="bairroComprador"/);
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

test('vehicle power of attorney uses a single make and model field', async () => {
  const [html, script] = await Promise.all([
    readFile('procuracao-veiculo.html', 'utf8'),
    readFile('procuracao.js', 'utf8'),
  ]);
  const makeAndModelInput = html.match(/<input[^>]*name="marcaModelo"[^>]*>/)?.[0];

  assert.ok(makeAndModelInput, 'Campo Marca/Modelo não encontrado');
  assert.match(makeAndModelInput, /\brequired\b/);
  assert.doesNotMatch(html, /name="marca"|name="modelo"/);
  assert.match(script, /valueOf\(data, 'marcaModelo'\)/);
  assert.doesNotMatch(script, /valueOf\(data, 'marca'\)|valueOf\(data, 'modelo'\)/);
});

test('power of attorney headings start below the MEGA logo', async () => {
  const [vehicleScript, saleIntentScript] = await Promise.all([
    readFile('procuracao.js', 'utf8'),
    readFile('intencao-venda.js', 'utf8'),
  ]);

  assert.match(vehicleScript, /\.title \{[^}]*margin: 12mm 0 16px;/);
  assert.match(saleIntentScript, /\.heading \{[^}]*margin: 14mm 24mm 8px;/);
});
