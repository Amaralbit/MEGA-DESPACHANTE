import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_PA2_IMAGES,
  MIN_PA2_IMAGES,
  PA2_ACCESS_CODE,
  PA2_LETTERHEAD_PATH,
  PA2_ROWS,
  calculatePa2FinesTotal,
  formatCurrencyValue,
  getPa2ClipboardImages,
  isValidPa2ImageCount,
  normalizePa2DocumentLabel,
  parseCurrencyValue,
} from '../pa2.js';

test('PA2 aceita de 1 a 10 imagens', () => {
  assert.equal(MIN_PA2_IMAGES, 1);
  assert.equal(MAX_PA2_IMAGES, 10);
  assert.equal(isValidPa2ImageCount(0), false);
  assert.equal(isValidPa2ImageCount(1), true);
  assert.equal(isValidPa2ImageCount(10), true);
  assert.equal(isValidPa2ImageCount(11), false);
});

test('PA2 extrai somente imagens JPG e PNG da área de transferência', () => {
  const png = { name: 'print.png', type: 'image/png' };
  const jpeg = { name: 'foto.jpg', type: 'image/jpeg' };
  const clipboardData = {
    items: [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => png },
      { kind: 'file', type: 'image/webp', getAsFile: () => ({ name: 'ignorar.webp', type: 'image/webp' }) },
      { kind: 'file', type: 'image/jpeg', getAsFile: () => jpeg },
    ],
  };

  assert.deepEqual(getPa2ClipboardImages(clipboardData), [png, jpeg]);
});

test('PA2 reconhece e formata valores brasileiros', () => {
  assert.equal(parseCurrencyValue('R$ 1.270,89'), 1270.89);
  assert.equal(parseCurrencyValue('400,00'), 400);
  assert.equal(parseCurrencyValue(''), null);
  assert.equal(formatCurrencyValue(5477.32), 'R$ 5.477,32');
});

test('PA2 não corrompe valores colados sem centavos ou com múltiplos separadores de milhar', () => {
  assert.equal(parseCurrencyValue('1.000'), 1000);
  assert.equal(parseCurrencyValue('12.000'), 12000);
  assert.equal(parseCurrencyValue('1.234.567'), 1234567);
  assert.equal(parseCurrencyValue('1.234.567,89'), 1234567.89);
  assert.equal(parseCurrencyValue('1200.50'), 1200.5);
  assert.equal(parseCurrencyValue('12.5'), 12.5);
});

test('PA2 contém as linhas do modelo de despesas', () => {
  assert.equal(PA2_ROWS.length, 18);
  assert.deepEqual(PA2_ROWS, [
    'Perícia e foto',
    'Taxa RENAVE',
    'Desalienação',
    'Multas',
    'Multas em estado de autuação',
    'IPVA',
    'Licenciamento',
    'SEFAZ',
    'Taxa de leasing',
    'Transferência de propriedade',
    '2ª via de recibo (DUT)',
    'Transferência de UF + município',
    'Vistoria DETRAN',
    'Honorário despachante',
    'Placa',
    'Benefício tributário',
    'Taxa ATPV-e',
    'Restrições',
  ]);
  assert.ok(!PA2_ROWS.includes('IPVA+LICENCIAMENTO'));
  assert.ok(PA2_ROWS.includes('Taxa ATPV-e'));
  assert.equal(PA2_ROWS[PA2_ROWS.indexOf('Taxa ATPV-e') + 1], 'Restrições');
});

test('PA2 soma multas normais e multas em estado de autuação', () => {
  const rows = PA2_ROWS.map(() => ({ amount: '' }));
  rows[PA2_ROWS.indexOf('Multas')].amount = 'R$ 250,50';
  rows[PA2_ROWS.indexOf('Multas em estado de autuação')].amount = '100,00';

  assert.equal(calculatePa2FinesTotal(rows), 350.5);
});

test('PA2 aceita somente as marcações de documento previstas', () => {
  assert.equal(normalizePa2DocumentLabel('doc digital'), 'DOC DIGITAL');
  assert.equal(normalizePa2DocumentLabel('DOC FÍSICO'), 'DOC FÍSICO');
  assert.equal(normalizePa2DocumentLabel(''), '');
  assert.equal(normalizePa2DocumentLabel('outro'), '');
});

test('PA2 usa o papel timbrado da MEGA atrás da tabela e identifica a empresa', async () => {
  const script = await readFile('pa2.js', 'utf8');
  await assert.doesNotReject(() => readFile(PA2_LETTERHEAD_PATH));
  assert.match(script, /drawPage\(letterheadPage/);
  assert.match(script, /opacity:\s*PA2_LETTERHEAD_OPACITY/);
  assert.match(script, /'MEGA DESPACHANTE'/);
  assert.match(script, /'MEGA DESPACHANTE \(CONT\.\)'/);
});

test('PA2 fica entre Formulários e A MEGA, aceita imagens coladas e não exige campos da tabela', async () => {
  const [home, page, script] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('pa2.html', 'utf8'),
    readFile('pa2.js', 'utf8'),
  ]);
  assert.match(home, /Formulários<\/a>[\s\S]*?pa2\.html">PA2<\/a>[\s\S]*?A MEGA<\/a>/);
  assert.doesNotMatch(page, /\srequired(?:\s|>|=)/i);
  assert.match(page, /mínimo de 1 e máximo de 10 imagens/i);
  assert.match(page, /Arraste ou cole as imagens aqui/i);
  assert.match(page, /Use Ctrl\+V para colar/i);
  assert.match(script, /document\.addEventListener\('paste'/);
  assert.match(script, /getPa2ClipboardImages\(event\.clipboardData\)/);
  assert.match(page, /name="documentType" value="DOC DIGITAL"/);
  assert.match(page, /name="documentType" value="DOC FÍSICO"/);
  assert.match(page, /pdf-lib\.min\.js[\s\S]*pa2\.js/);
});

test('PA2 oferece uma ação confirmada para limpar todos os dados', async () => {
  const [page, script] = await Promise.all([
    readFile('pa2.html', 'utf8'),
    readFile('pa2.js', 'utf8'),
  ]);

  assert.match(page, /id="pa2-clear-data"[^>]*type="button"[^>]*>Limpar dados<\/button>/);
  assert.match(script, /clearDataButton\?\.addEventListener\('click'/);
  assert.match(script, /window\.confirm\('Limpar todos os dados do PA2\?/);
  assert.match(script, /entries\.forEach\(releaseEntry\);[\s\S]*entries = \[\];[\s\S]*form\.reset\(\);/);
});

test('PA2 envia observações finais para o fim do PDF', async () => {
  const [page, script] = await Promise.all([
    readFile('pa2.html', 'utf8'),
    readFile('pa2.js', 'utf8'),
  ]);

  assert.match(page, /textarea name="finalObservations"[^>]*placeholder="Informações adicionais que aparecerão no fim do PA2"/);
  assert.match(script, /finalObservations: form\.elements\.finalObservations\.value\.trim\(\)/);
  assert.match(script, /drawFinalObservations\(\{ table, text: finalObservationsText, font, boldFont \}\)/);
  assert.match(script, /OBSERVAÇÕES FINAIS/);
});

test('PA2 só mostra a soma das multas na observação da linha quando ambos os valores estiverem preenchidos', async () => {
  const script = await readFile('pa2.js', 'utf8');

  assert.doesNotMatch(script, /table\.page\.drawText\(finesSummary/);
  assert.match(script, /const bothFinesFilled = Number\.isFinite\(parseCurrencyValue\(rows\[PA2_ROWS\.indexOf\('Multas'\)\]\?\.amount\)\)/);
  assert.match(script, /const finesSummaryText = bothFinesFilled/);
  assert.match(script, /description === 'Multas em estado de autuação' && finesSummaryText/);
});

test('PA2 destaca a soma das multas em verde e trava a observação quando ambas as multas estão preenchidas', async () => {
  const script = await readFile('pa2.js', 'utf8');

  assert.match(script, /success: window\.PDFLib\.rgb\(0\.11, 0\.47, 0\.22\)/);
  assert.match(script, /cellColors\?\.\[index\] \|\| colors\.ink/);
  assert.match(script, /\[undefined, undefined, table\.colors\.success\]/);
  assert.match(script, /autuacaoNoteInput\.disabled = bothFinesFilled/);
  assert.match(script, /if \(bothFinesFilled\) autuacaoNoteInput\.value = '';/);
});

test('PA2 fica atrás de um código de acesso aceito em maiúsculas ou minúsculas', async () => {
  const [page, script] = await Promise.all([
    readFile('pa2.html', 'utf8'),
    readFile('pa2.js', 'utf8'),
  ]);

  assert.match(page, /<body class="forms-page pa2-page pa2-locked">/);
  assert.match(page, /id="pa2-gate"/);
  assert.match(page, /sessionStorage\.getItem\('pa2-access-granted'\) === 'true'/);
  assert.doesNotMatch(page, /\srequired(?:\s|>|=)/i);
  assert.equal(typeof PA2_ACCESS_CODE, 'string');
  assert.ok(PA2_ACCESS_CODE.trim().length > 0);
  assert.match(script, /gateInput\.value\.trim\(\)\.toLowerCase\(\)/);
  assert.match(script, /PA2_ACCESS_CODE\.trim\(\)\.toLowerCase\(\)/);
  assert.match(script, /sessionStorage\.setItem\(PA2_ACCESS_STORAGE_KEY, 'true'\)/);
});

test('PA2 esquece o código quando a aba/navegador fecha, mas não ao trocar de página', async () => {
  const [page, script] = await Promise.all([
    readFile('pa2.html', 'utf8'),
    readFile('pa2.js', 'utf8'),
  ]);

  assert.doesNotMatch(page, /localStorage/);
  assert.doesNotMatch(script, /\blocalStorage\b/);
});
