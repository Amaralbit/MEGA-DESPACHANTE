import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('every catalog card is a native link across its whole area', async () => {
  const catalog = await readFile('formularios.html', 'utf8');
  const linkedCards = catalog.match(/<a class="form-option(?: form-option-tool)?" href="[^"]+" aria-label="[^"]+">/g) || [];

  assert.equal(linkedCards.length, 11);
  assert.doesNotMatch(catalog, /<article class="form-option/);
  assert.doesNotMatch(catalog, /<a class="form-card-link"/);
  assert.match(catalog, /<span class="form-card-link" aria-hidden="true">↗<\/span>/);
});

test('forms and PDF tools live in separate accessible tabs', async () => {
  const catalog = await readFile('formularios.html', 'utf8');
  const behavior = await readFile('formularios.js', 'utf8');

  assert.match(catalog, /role="tablist"/);
  assert.match(catalog, /data-catalog-tab="documents"/);
  assert.match(catalog, /data-catalog-tab="tools"/);
  assert.match(catalog, /data-catalog-panel="documents"/);
  assert.match(catalog, /data-catalog-panel="tools" hidden/);
  assert.match(catalog, /type="module" src="formularios\.js"/);
  assert.match(behavior, /ArrowLeft/);
  assert.match(behavior, /ArrowRight/);
  assert.match(behavior, /#ferramentas-pdf/);
  assert.match(behavior, /addEventListener\('hashchange'/);
  assert.match(behavior, /panel\.hidden = panel\.dataset\.catalogPanel !== name/);
  assert.match(catalog, /<aside aria-label="Atendimento pelo WhatsApp">/);
});
