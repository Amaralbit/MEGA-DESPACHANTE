import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const MAX_HTML_LENGTH = 250_000;
const PUBLIC_ASSET_BASE = 'https://amaralbit.github.io/MEGA-DESPACHANTE/assets/';
const DEFAULT_SIGNATURE_URL = `${PUBLIC_ASSET_BASE}assinatura-sergio-pdf.png`;
const PDF_LOGO_URL = `${PUBLIC_ASSET_BASE}logo-mega-pdf.png`;

const documentRules = {
  'procuracao-veiculo': {
    title: 'Procuração para veículo',
    fileName: 'procuracao-veiculo.pdf',
  },
  'procuracao-intencao-venda': {
    title: 'Procuração - Intenção de venda',
    fileName: 'procuracao-intencao-venda.pdf',
  },
  'declaracao-residencia': {
    title: 'Declaração de residência',
    fileName: 'declaracao-residencia.pdf',
  },
  'averbacao-cancelamento': {
    title: 'Averbação e cancelamento de impedimento de licenciamento',
    fileName: 'averbacao-cancelamento.pdf',
  },
  'declaracao-motor': {
    title: 'Declaração de responsabilidade pela procedência de motor',
    fileName: 'declaracao-motor.pdf',
  },
  'alteracao-caracteristica': {
    title: 'Requerimento para alteração de característica veicular',
    fileName: 'alteracao-caracteristica.pdf',
  },
  'regravacao-chassi': {
    title: 'Requerimento para regravação de chassi',
    fileName: 'regravacao-chassi.pdf',
  },
  'requerimento-segunda-via': {
    title: 'Requerimento 2ª via CRV / CRLV',
    fileName: 'requerimento-segunda-via.pdf',
  },
};

const DEFAULT_ALLOWED_ORIGINS = [
  'https://amaralbit.github.io',
  'https://mega-despachante-seguro.vercel.app',
  'https://mega-despachante.vercel.app',
];

const allowedOrigins = () => [...new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
])];

export const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins().includes(origin)) return true;
  if (origin === 'null') return true;
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
};

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const parseBody = (body) => {
  if (typeof body === 'string') return JSON.parse(body);
  if (body && typeof body === 'object') return body;
  return {};
};

const normalizeAssetUrls = (html) => html.replace(
  /(?:file:\/\/\/[^"'()\s>]*\/)?assets\/logo-mega-transparent\.png/gi,
  PDF_LOGO_URL,
);

export const prepareSignedHtml = ({ html, documentType, signatureUrl = DEFAULT_SIGNATURE_URL }) => {
  const rule = documentRules[documentType];
  if (!rule) throw new Error('Tipo de documento não autorizado.');
  if (typeof html !== 'string' || !html.trim() || html.length > MAX_HTML_LENGTH) {
    throw new Error('Conteúdo do documento inválido.');
  }
  if (!html.includes(`<title>${rule.title}</title>`)) {
    throw new Error('O conteúdo não corresponde ao tipo de documento informado.');
  }
  if ((html.match(/<!--MEGA_PROTECTED_SIGNATURE-->/g) || []).length !== 1) {
    throw new Error('Área de assinatura protegida inválida.');
  }
  if (/<(?:script|iframe|object|embed|link|meta\s+http-equiv)\b/i.test(html) || /javascript\s*:/i.test(html) || /@import/i.test(html)) {
    throw new Error('O documento contém elementos não permitidos.');
  }

  let safeHtml = normalizeAssetUrls(html);
  safeHtml = safeHtml
    .replace(/<button\b[^>]*class=["'][^"']*\bprint-hint\b[^"']*["'][^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/<img\b([^>]*?)src=(?:"[^"]*"|'[^']*')([^>]*)>/gi, (image, before, after) => {
      if (/logo-symbol/i.test(image)) {
        return `<img${before}src="${PDF_LOGO_URL}"${after}>`;
      }
      return '';
    })
    .replace(
      '<!--MEGA_PROTECTED_SIGNATURE-->',
      `<img src="${signatureUrl}" alt="Assinatura do responsável da MEGA Despachante">`,
    );

  return { html: safeHtml, fileName: rule.fileName };
};

const launchBrowser = async () => {
  const onVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
  const executablePath = onVercel
    ? await chromium.executablePath()
    : process.env.CHROME_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const args = onVercel
    ? chromium.args
    : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];

  return puppeteer.launch({
    args,
    executablePath,
    headless: true,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
  });
};

const renderPdf = async (html, signatureUrl) => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const allowed = url === signatureUrl
        || url === PDF_LOGO_URL
        || url.startsWith('data:');
      if (allowed) request.continue();
      else request.abort();
    });
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }));
      await document.fonts.ready;
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    console.warn('[generate-pdf] Origem recusada', { origin });
    return sendJson(res, 403, { error: 'Origem não autorizada.' });
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return sendJson(res, 405, { error: 'Método não permitido.' });
  }

  let payload;
  try {
    payload = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: 'Requisição inválida.' });
  }

  const signatureUrl = process.env.PDF_SIGNATURE_URL || DEFAULT_SIGNATURE_URL;
  let prepared;
  try {
    prepared = prepareSignedHtml({
      html: payload.html,
      documentType: payload.documentType,
      signatureUrl,
    });
  } catch (validationError) {
    return sendJson(res, 400, { error: validationError.message });
  }

  try {
    const pdf = await renderPdf(prepared.html, signatureUrl);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Content-Disposition', `attachment; filename="${prepared.fileName}"`);
    return res.end(pdf);
  } catch (renderError) {
    console.error('Falha ao gerar PDF protegido:', renderError);
    return sendJson(res, 500, { error: 'Não foi possível gerar o PDF agora.' });
  }
}
