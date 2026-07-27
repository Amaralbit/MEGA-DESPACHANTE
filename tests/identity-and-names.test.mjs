import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const optionalIdentityFields = [
  ['procuracao-veiculo.html', ['identidade', 'orgao']],
  ['procuracao-particular.html', ['outorganteRg', 'outorganteOrgao', 'procuradorRg', 'procuradorOrgao']],
  ['declaracao-residencia.html', ['identidade', 'orgaoEmissor', 'ufEmissao']],
  ['requerimento-alteracao-caracteristica.html', ['rg', 'orgaoExpedidor']],
  ['requerimento-regravacao-chassi.html', ['rg', 'orgaoExpedidor']],
  ['averbacao-cancelamento-impedimento.html', ['rg', 'orgaoExpedidor']],
  ['declaracao-procedencia-motor.html', ['rg', 'orgaoExpedidor']],
  ['requerimento-segunda-via.html', ['identidade', 'orgao']],
];

test('RG and its issuing details are optional in every applicable form', async () => {
  for (const [file, fieldNames] of optionalIdentityFields) {
    const html = await readFile(file, 'utf8');
    for (const fieldName of fieldNames) {
      const input = html.match(new RegExp(`<input[^>]*name="${fieldName}"[^>]*>`))?.[0];
      assert.ok(input, `Campo ${fieldName} não encontrado em ${file}`);
      assert.doesNotMatch(input, /\brequired\b/, `${fieldName} ainda é obrigatório em ${file}`);
    }
  }
});

const nameFieldsByDocument = [
  ['procuracao.js', ['outorgante']],
  ['intencao-venda.js', ['vendedor', 'comprador']],
  ['procuracao-particular.js', ['outorganteNome', 'procuradorNome']],
  ['declaracao-residencia.js', ['nome']],
  ['requerimento-alteracao-caracteristica.js', ['proprietario']],
  ['requerimento-regravacao-chassi.js', ['requerente', 'proprietarioVeiculo']],
  ['averbacao-cancelamento-impedimento.js', ['requerente']],
  ['declaracao-procedencia-motor.js', ['proprietario']],
  ['requerimento-segunda-via.js', ['proprietario']],
];

test('all names are rendered in uppercase and bold in generated documents', async () => {
  for (const [file, fieldNames] of nameFieldsByDocument) {
    const script = await readFile(file, 'utf8');
    assert.match(script, /const nameOf = .*toLocaleUpperCase\('pt-BR'\)/);

    for (const fieldName of fieldNames) {
      assert.match(script, new RegExp(`nameOf\\(data, '${fieldName}'\\)`));
    }
  }

  const procuracao = await readFile('procuracao.js', 'utf8');
  assert.equal(procuracao.match(/<strong>\$\{outorgante\}<\/strong>/g)?.length, 2);
});
