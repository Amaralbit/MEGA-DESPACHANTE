import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import {
  COMPRESSION_PRESETS,
  calculateCompressionSavings,
  formatCompressedBytes,
  getCompressionAttempts,
  getRenderScale,
  hasPdfDigitalSignature,
  normalizeCompressedName,
} from '../compress-pdf-utils.js';

test('PDF compressor is local, linked from the tools tab and self-hosts PDF.js', async () => {
  const catalog = await readFile('formularios.html', 'utf8');
  const page = await readFile('comprimir-pdf.html', 'utf8');
  const script = await readFile('comprimir-pdf.js', 'utf8');
  const license = await readFile('assets/vendor/pdfjs/LICENSE', 'utf8');
  const pdfJs = await stat('assets/vendor/pdfjs/pdf.min.mjs');
  const worker = await stat('assets/vendor/pdfjs/pdf.worker.min.mjs');

  assert.match(catalog, /Ferramentas PDF <span>03<\/span>/);
  assert.match(catalog, /href="comprimir-pdf\.html"/);
  assert.match(page, /Processamento 100% local/);
  assert.match(page, /href="https:\/\/www\.ilovepdf\.com\/pt\/comprimir_pdf" target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /serviço externo/);
  assert.match(page, /type="module" src="comprimir-pdf\.js"/);
  assert.doesNotMatch(page, /cdn\.|unpkg|jsdelivr/i);
  assert.doesNotMatch(script, /\/api\//);
  assert.match(script, /pdfjsLib\.getDocument/);
  assert.match(script, /sourcePage\.render/);
  assert.match(script, /loadingTask\?\.destroy/);
  assert.doesNotMatch(script, /documentProxy\.destroy/);
  assert.match(script, /compressedBytes\.length >= selectedFile\.size/);
  assert.match(script, /getCompressionAttempts/);
  assert.match(script, /Ajustando a qualidade/);
  assert.match(script, /compressedBytes = undefined/);
  assert.match(script, /lastCompressionError/);
  assert.match(license, /Apache License/);
  assert.ok(pdfJs.size > 300_000);
  assert.ok(worker.size > 700_000);
});

test('PDF compressor formats names, detects signatures and calculates real savings', () => {
  assert.equal(formatCompressedBytes(1536), '2 KB');
  assert.equal(formatCompressedBytes(2.5 * 1024 * 1024), '2,5 MB');
  assert.equal(normalizeCompressedName(' Processo: 123?.pdf '), 'Processo- 123-.pdf');
  assert.equal(normalizeCompressedName(''), 'documento-comprimido.pdf');
  assert.equal(calculateCompressionSavings(10_000, 6_400), 36);
  assert.equal(calculateCompressionSavings(10_000, 12_000), 0);
  assert.equal(hasPdfDigitalSignature(new TextEncoder().encode('%PDF /Type/Sig /ByteRange[0 10]')), true);
  assert.equal(hasPdfDigitalSignature(new TextEncoder().encode('%PDF documento comum')), false);
});

test('PDF compressor quality presets respect their resolution caps', () => {
  assert.ok(COMPRESSION_PRESETS.high.scale > COMPRESSION_PRESETS.balanced.scale);
  assert.ok(COMPRESSION_PRESETS.balanced.scale > COMPRESSION_PRESETS.small.scale);
  assert.ok(COMPRESSION_PRESETS.high.jpegQuality > COMPRESSION_PRESETS.small.jpegQuality);
  assert.equal(getRenderScale(595, 842, COMPRESSION_PRESETS.balanced), COMPRESSION_PRESETS.balanced.scale);
  assert.ok(getRenderScale(5000, 3000, COMPRESSION_PRESETS.high) < 1);

  const highAttempts = getCompressionAttempts('high');
  const balancedAttempts = getCompressionAttempts('balanced');
  const smallAttempts = getCompressionAttempts('small');

  assert.equal(highAttempts.length, 5);
  assert.equal(highAttempts[0], COMPRESSION_PRESETS.high);
  assert.ok(highAttempts.every((preset, index) => index === 0 || preset.scale < highAttempts[index - 1].scale));
  assert.ok(highAttempts.every((preset, index) => index === 0 || preset.jpegQuality < highAttempts[index - 1].jpegQuality));
  assert.equal(highAttempts.at(-1), COMPRESSION_PRESETS.small);

  assert.equal(balancedAttempts.length, 4);
  assert.equal(balancedAttempts[0], COMPRESSION_PRESETS.balanced);
  assert.ok(balancedAttempts.every((preset, index) => index === 0 || preset.scale < balancedAttempts[index - 1].scale));
  assert.ok(balancedAttempts.every((preset, index) => index === 0 || preset.jpegQuality < balancedAttempts[index - 1].jpegQuality));
  assert.equal(balancedAttempts.at(-1), COMPRESSION_PRESETS.small);
  assert.deepEqual(smallAttempts, [COMPRESSION_PRESETS.small]);
  assert.deepEqual(getCompressionAttempts('unknown'), balancedAttempts);
});
