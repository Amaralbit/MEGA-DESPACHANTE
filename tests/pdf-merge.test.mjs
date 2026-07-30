import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {
  formatBytes,
  hasDigitalSignature,
  mergePdfEntries,
  normalizeOutputName,
} from '../juntar-pdfs.js';

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

test('PDF merger is linked from the catalog and loads only local application assets', async () => {
  const catalog = await readFile('formularios.html', 'utf8');
  const page = await readFile('juntar-pdfs.html', 'utf8');
  const script = await readFile('juntar-pdfs.js', 'utf8');
  const license = await readFile('assets/vendor/pdf-lib/LICENSE.md', 'utf8');
  const vendor = await stat('assets/vendor/pdf-lib/pdf-lib.min.js');

  assert.match(catalog, /10 recursos/);
  assert.match(catalog, /href="juntar-pdfs\.html"/);
  assert.match(page, /Processamento 100% local/);
  assert.match(page, /assets\/vendor\/pdf-lib\/pdf-lib\.min\.js/);
  assert.doesNotMatch(page, /cdn\.|unpkg|jsdelivr/i);
  assert.doesNotMatch(script, /\bfetch\s*\(|\/api\//);
  assert.match(license, /MIT License/);
  assert.ok(vendor.size > 500_000);
});

test('PDF merger formats sizes, sanitizes names and detects signature markers', () => {
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB');
  assert.equal(normalizeOutputName(' documentos: DETRAN?.pdf '), 'documentos- DETRAN-.pdf');
  assert.equal(normalizeOutputName(''), 'documentos-detran.pdf');
  assert.equal(hasDigitalSignature(new TextEncoder().encode('%PDF /ByteRange [0 10 20 30]')), true);
  assert.equal(hasDigitalSignature(new TextEncoder().encode('%PDF documento comum')), false);
});

test('PDF merger preserves file order and every selected page', async () => {
  const { PDFDocument } = await loadVendoredPdfLib();
  const first = await PDFDocument.create();
  first.addPage().setSize(210, 310);
  first.addPage().setSize(220, 320);
  const second = await PDFDocument.create();
  second.addPage().setSize(410, 510);

  const mergedBytes = await mergePdfEntries([
    { bytes: await first.save() },
    { bytes: await second.save() },
  ], PDFDocument);
  const merged = await PDFDocument.load(mergedBytes);
  const sizes = merged.getPages().map((page) => page.getSize());

  assert.equal(merged.getPageCount(), 3);
  assert.equal(
    JSON.stringify(sizes.map(({ width, height }) => [width, height])),
    JSON.stringify([[210, 310], [220, 320], [410, 510]]),
  );
});
