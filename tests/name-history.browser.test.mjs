import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import puppeteer from 'puppeteer-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const candidates = [
  process.env.CHROME_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const browserPath = await (async () => {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // The browser is optional in environments that only run the unit tests.
    }
  }
  return null;
})();

test('o nome continua disponível em outra procuração e armazenamento bloqueado não impede o documento', {
  skip: !browserPath && 'Chrome/Edge não instalado',
}, async () => {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(join(root, decodeURIComponent(pathname)));
    if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));

  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${origin}/procuracao-veiculo.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#procuracao-form[data-premium-ready="true"]');

    await page.evaluate(() => {
      const field = document.querySelector('input[name="outorgante"]');
      for (const name of ['SAGA AUTOMÓVEIS LTDA', ...Array.from({ length: 12 }, (_, index) => `CLIENTE ${index + 1}`)]) {
        field.focus();
        field.value = name;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.blur();
      }
    });

    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('mega-field-history:v2:autocomplete-name')));
    assert.ok(history.includes('SAGA AUTOMÓVEIS LTDA'));
    assert.equal(history.length, 13);

    await page.goto(`${origin}/procuracao-particular.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#procuracao-particular-form[data-premium-ready="true"]');
    await page.type('input[name="outorganteNome"]', 'saga');
    const suggestion = 'input[name="outorganteNome"] + .field-suggestions .field-suggestion';
    await page.waitForSelector(suggestion, { visible: true });
    assert.equal(await page.$eval(suggestion, (button) => button.textContent), 'SAGA AUTOMÓVEIS LTDA');
    await page.click(suggestion);
    assert.equal(await page.$eval('input[name="outorganteNome"]', (field) => field.value), 'SAGA AUTOMÓVEIS LTDA');
    assert.equal(await page.$eval('input[name="outorganteNome"] + .field-suggestions', (list) => list.hidden), true);
    await page.$eval('input[name="outorganteNome"]', (field) => field.dispatchEvent(new Event('input', { bubbles: true })));
    assert.equal(await page.$eval(suggestion, (button) => button.textContent), 'SAGA AUTOMÓVEIS LTDA');

    const blockedPage = await browser.newPage();
    const pageErrors = [];
    blockedPage.on('pageerror', (error) => pageErrors.push(error.message));
    await blockedPage.evaluateOnNewDocument(() => {
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        Storage.prototype[method] = () => { throw new DOMException('Armazenamento bloqueado', 'SecurityError'); };
      }
    });
    await blockedPage.goto(`${origin}/procuracao-veiculo.html`, { waitUntil: 'domcontentloaded' });
    await blockedPage.waitForSelector('#procuracao-form[data-premium-ready="true"]');
    await blockedPage.evaluate(() => {
      const form = document.querySelector('#procuracao-form');
      form.elements.outorgante.value = 'SAGA';
      form.elements.servico.value = 'Representar o outorgante';
      form.megaValidateForEditor = () => true;
    });
    await blockedPage.$eval('#signature-editor-trigger', (button) => button.click());
    await blockedPage.waitForFunction(() => document.querySelector('.signature-editor-frame')?.contentDocument?.body?.innerText.includes('SAGA'));
    assert.deepEqual(pageErrors, []);
    assert.match(await blockedPage.$eval('.premium-save-status', (status) => status.textContent), /navegador não permitiu salvar/);
  } finally {
    await browser?.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
