import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const optionalIssuerFields = [
  ['procuracao-veiculo.html', 'orgao'],
  ['procuracao-particular.html', 'outorganteOrgao'],
  ['procuracao-intencao-venda.html', 'orgaoVendedor'],
];

for (const [file, fieldName] of optionalIssuerFields) {
  test(`${fieldName} is optional in ${file}`, async () => {
    const html = await readFile(file, 'utf8');
    const input = html.match(new RegExp(`<input[^>]*name="${fieldName}"[^>]*>`))?.[0];

    assert.ok(input, `Campo ${fieldName} não encontrado`);
    assert.doesNotMatch(input, /\brequired\b/);
  });
}
