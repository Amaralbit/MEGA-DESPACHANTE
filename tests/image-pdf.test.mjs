import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {
  createImagesPdf,
  fitImageOnPage,
  formatImageBytes,
  normalizeImagePdfName,
} from '../imagens-para-pdf.js';

const loadVendoredPdfLib = async () => {
  const source = await readFile('assets/vendor/pdf-lib/pdf-lib.min.js', 'utf8');
  const context = {
    ArrayBuffer,
    DataView,
    Math,
    Object,
    Promise,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    setTimeout,
  };
  context.globalThis = context;
  context.self = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.PDFLib;
};

test('image converter is linked from the catalog and keeps document processing local', async () => {
  const catalog = await readFile('formularios.html', 'utf8');
  const page = await readFile('imagens-para-pdf.html', 'utf8');
  const script = await readFile('imagens-para-pdf.js', 'utf8');

  assert.match(catalog, /11 recursos/);
  assert.match(catalog, /href="imagens-para-pdf\.html"/);
  assert.match(page, /Processamento 100% local/);
  assert.match(page, /image\/jpeg,image\/png/);
  assert.match(page, /assets\/vendor\/pdf-lib\/pdf-lib\.min\.js/);
  assert.doesNotMatch(page, /cdn\.|unpkg|jsdelivr/i);
  assert.doesNotMatch(script, /\bfetch\s*\(|\/api\//);
});

test('image converter formats values and fits images without cropping', () => {
  assert.equal(formatImageBytes(1536), '2 KB');
  assert.equal(formatImageBytes(2.5 * 1024 * 1024), '2,5 MB');
  assert.equal(normalizeImagePdfName(' CNH: frente?.pdf '), 'CNH- frente-.pdf');
  assert.equal(normalizeImagePdfName(''), 'documentos-detran.pdf');

  const portrait = fitImageOnPage(1000, 2000, 595.28, 841.89);
  assert.ok(portrait.width <= 595.28 - 56.7);
  assert.ok(portrait.height <= 841.89 - 56.7);
  assert.equal(Math.round((portrait.width / portrait.height) * 100), 50);

  const landscape = fitImageOnPage(2000, 1000, 841.89, 595.28);
  assert.ok(landscape.width <= 841.89 - 56.7);
  assert.ok(landscape.height <= 595.28 - 56.7);
  assert.equal(Math.round((landscape.width / landscape.height) * 100), 200);
});

test('image converter creates one correctly oriented A4 page per image', async () => {
  const { PDFDocument } = await loadVendoredPdfLib();
  const pngBytes = Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZcZsAAAAASUVORK5CYII=',
    'base64',
  ));
  const pdfBytes = await createImagesPdf([
    { bytes: pngBytes, mimeType: 'image/png', width: 900, height: 1400 },
    { bytes: pngBytes, mimeType: 'image/png', width: 1600, height: 900 },
  ], PDFDocument);
  const pdf = await PDFDocument.load(pdfBytes);
  const sizes = pdf.getPages().map((page) => page.getSize());

  assert.equal(pdf.getPageCount(), 2);
  assert.ok(sizes[0].height > sizes[0].width);
  assert.ok(sizes[1].width > sizes[1].height);
  assert.equal(Math.round(sizes[0].width), 595);
  assert.equal(Math.round(sizes[1].width), 842);
});
