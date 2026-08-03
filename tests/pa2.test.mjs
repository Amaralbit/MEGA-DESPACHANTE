import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PA2_ROWS,
  formatCurrencyValue,
  isValidPa2ImageCount,
  parseCurrencyValue,
} from '../pa2.js';

test('PA2 aceita somente de 3 a 6 imagens', () => {
  assert.equal(isValidPa2ImageCount(2), false);
  assert.equal(isValidPa2ImageCount(3), true);
  assert.equal(isValidPa2ImageCount(6), true);
  assert.equal(isValidPa2ImageCount(7), false);
});

test('PA2 reconhece e formata valores brasileiros', () => {
  assert.equal(parseCurrencyValue('R$ 1.270,89'), 1270.89);
  assert.equal(parseCurrencyValue('400,00'), 400);
  assert.equal(parseCurrencyValue(''), null);
  assert.equal(formatCurrencyValue(5477.32), 'R$ 5.477,32');
});

test('PA2 contém as linhas do modelo de despesas', () => {
  assert.equal(PA2_ROWS.length, 15);
  assert.ok(PA2_ROWS.includes('Perícia e foto'));
  assert.ok(PA2_ROWS.includes('Taxa ATPV-e'));
});

test('PA2 fica entre Formulários e A MEGA e não exige campos da tabela', async () => {
  const [home, page] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('pa2.html', 'utf8'),
  ]);
  assert.match(home, /Formulários<\/a>[\s\S]*?pa2\.html">PA2<\/a>[\s\S]*?A MEGA<\/a>/);
  assert.doesNotMatch(page, /\srequired(?:\s|>|=)/i);
  assert.match(page, /mínimo de 3 e máximo de 6 imagens/i);
  assert.match(page, /pdf-lib\.min\.js[\s\S]*pa2\.js/);
});
