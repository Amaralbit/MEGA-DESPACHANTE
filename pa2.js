import { formatImageBytes, prepareImageForPdf } from './imagens-para-pdf.js';

export const MIN_PA2_IMAGES = 1;
export const MAX_PA2_IMAGES = 10;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);
const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const PAGE_MARGIN = 28.35;
export const PA2_LETTERHEAD_PATH = 'assets/papel-timbrado-mega-despachante.pdf';
const PA2_LETTERHEAD_OPACITY = 0.18;

// Código de acesso ao PA2. Troque o valor abaixo para definir/alterar o código
// (a comparação ignora maiúsculas/minúsculas e espaços nas pontas).
export const PA2_ACCESS_CODE = 'consulta';
const PA2_ACCESS_STORAGE_KEY = 'pa2-access-granted';

export const PA2_ROWS = Object.freeze([
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

export const MOBILE_PA2_VALUE_ROWS = Object.freeze([
  { name: 'gravame', label: 'Baixa do gravame', group: 'debts' },
  { name: 'ipva', label: 'IPVA', group: 'debts', statusName: 'ipvaParcelado', statusLabel: 'Parcelado' },
  { name: 'licenciamento', label: 'Licenciamento', group: 'debts' },
  { name: 'multasEmitidas', label: 'Multas emitidas', group: 'debts', statusName: 'multasEmitidasNc', statusLabel: 'N/C' },
  { name: 'multasNaoEmitidas', label: 'Multas não emitidas', group: 'debts', statusName: 'multasNaoEmitidasNc', statusLabel: 'N/C' },
  { name: 'totalServicos', label: 'Total de serviços', group: 'services' },
  { name: 'vistoriaCautelar', label: 'Vistoria cautelar', group: 'services' },
]);

const MOBILE_PA2_NOTE_TARGETS = Object.freeze({
  general: 'Observações gerais',
  ipva: 'IPVA',
  licenciamento: 'Licenciamento',
  multasEmitidas: 'Multas emitidas',
  multasNaoEmitidas: 'Multas não emitidas',
});

export const normalizeMobilePa2Notes = (notes) => {
  if (!Array.isArray(notes)) return [];
  return notes.reduce((validNotes, note) => {
    const target = String(note?.target || '');
    const text = String(note?.text || '').trim();
    if (MOBILE_PA2_NOTE_TARGETS[target] && text) {
      validNotes.push({ target, text: text.slice(0, 300) });
    }
    return validNotes;
  }, []);
};

export const getMobilePa2NotesForTarget = (data, target) => {
  const savedNotes = normalizeMobilePa2Notes(data?.mobileNotes)
    .filter((note) => note.target === target)
    .map((note) => note.text);
  if (target === 'general' && !savedNotes.length && data?.mobileObservations) {
    savedNotes.push(String(data.mobileObservations).trim());
  }
  return savedNotes.filter(Boolean).join(' • ');
};

const MOBILE_PA2_TEXT_FIELDS = Object.freeze([
  { name: 'cliente', label: 'Cliente' },
  { name: 'placa', label: 'Placa', uppercase: true },
  { name: 'uf', label: 'UF', maxlength: 2, uppercase: true },
  { name: 'marcaModelo', label: 'Marca / modelo' },
  { name: 'anoModeloFab', label: 'Ano modelo / fabricação' },
  { name: 'dataTransferencia', label: 'Data da transf. / inclusão', type: 'date' },
  { name: 'dataSolicitacao', label: 'Data da solicitação', type: 'date' },
]);

const MOBILE_PA2_DOCUMENT_FIELDS = Object.freeze([
  { name: 'procuracaoPublica', label: 'Procuração pública', type: 'checkbox' },
  { name: 'rgCpfEndereco', label: 'RG / CPF / endereço', type: 'checkbox' },
  { name: 'contratoSocial', label: 'Contrato social', type: 'checkbox' },
  { name: 'crvAtpv', label: 'CRV / ATPV', type: 'checkbox' },
  { name: 'crlv', label: 'CRLV', type: 'checkbox' },
  { name: 'documentoFormato', label: 'Documento', type: 'radio', options: ['Físico', 'Digital'] },
  { name: 'gravameStatus', label: 'Situação do gravame', type: 'radio', options: ['Ativo', 'Baixado', 'Sem reserva de domínio'] },
  { name: 'ipvaParcelado', label: 'IPVA parcelado', type: 'checkbox' },
  { name: 'multasEmitidasNc', label: 'Multas emitidas: N/C', type: 'checkbox' },
  { name: 'multasNaoEmitidasNc', label: 'Multas não emitidas: N/C', type: 'checkbox' },
]);

const PA2_FINE_DESCRIPTIONS = new Set(['Multas', 'Multas em estado de autuação']);

export const PA2_DOCUMENT_OPTIONS = Object.freeze(['DOC DIGITAL', 'DOC FÍSICO']);

export const normalizePa2DocumentLabel = (value) => (
  PA2_DOCUMENT_OPTIONS.includes(String(value || '').trim().toUpperCase())
    ? String(value).trim().toUpperCase()
    : ''
);

export const isValidPa2ImageCount = (count) => (
  Number.isInteger(count) && count >= MIN_PA2_IMAGES && count <= MAX_PA2_IMAGES
);

export const getPa2ClipboardImages = (clipboardData) => {
  const itemFiles = [...(clipboardData?.items || [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file) => file && ACCEPTED_TYPES.has(file.type));
  if (itemFiles.length) return itemFiles;
  return [...(clipboardData?.files || [])].filter((file) => ACCEPTED_TYPES.has(file.type));
};

export const parseCurrencyValue = (value) => {
  const cleaned = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || !/\d/.test(cleaned)) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    // Tem os dois separadores: o que aparece por último é o decimal, e o
    // outro (onde aparecer) é separador de milhar. Cobre tanto o padrão BR
    // ("1.172,65") quanto sistemas no formato americano copiados sem querer
    // ("1,172.65", onde o ponto é o decimal e a vírgula é o milhar).
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastComma !== -1) {
    const tail = cleaned.slice(lastComma + 1);
    normalized = cleaned.split(',').length > 2 || tail.length === 3
      // Mais de uma vírgula, ou uma vírgula seguida de 3 dígitos, só pode ser
      // separador de milhar (ex.: "1,172" ou "1,234,567") — valor monetário
      // nunca tem 3 casas decimais.
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
  } else if (lastDot !== -1) {
    const tail = cleaned.slice(lastDot + 1);
    if (cleaned.split('.').length > 2 || tail.length === 3) {
      // Mais de um ponto, ou um ponto seguido de 3 dígitos, só pode ser
      // separador de milhar (ex.: "1.000" ou "1.234.567").
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
};

export const formatCurrencyValue = (value) => {
  if (!Number.isFinite(value)) return '';
  const [integer, decimals] = value.toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${decimals}`;
};

export const calculatePa2FinesTotal = (rows = []) => PA2_ROWS.reduce((total, description, index) => {
  if (!PA2_FINE_DESCRIPTIONS.has(description)) return total;
  const amount = parseCurrencyValue(rows[index]?.amount);
  return total + (Number.isFinite(amount) ? amount : 0);
}, 0);

export const calculateMobilePa2Total = (values = {}) => MOBILE_PA2_VALUE_ROWS.reduce((total, row) => {
  if (row.isTotal === false) return total;
  const amount = parseCurrencyValue(values[row.name]);
  return total + (Number.isFinite(amount) ? amount : 0);
}, 0);

const normalizeFilename = (value, fallback = 'PA2') => {
  const base = String(value || fallback)
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  return `${base || fallback}.pdf`;
};

const createBrowserImage = async (file, url) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Imagem sem dimensões válidas.');
  return image;
};

const wrapText = (text, font, fontSize, maxWidth) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }
    let fragment = '';
    for (const character of word) {
      if (font.widthOfTextAtSize(fragment + character, fontSize) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment += character;
      }
    }
    line = fragment;
  }
  if (line) lines.push(line);
  return lines;
};

const drawCellText = ({ page, text, font, size, color, x, y, width, height, padding = 5 }) => {
  const lines = wrapText(text, font, size, width - (padding * 2));
  const lineHeight = size + 2;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  let cursorY = y + ((height + totalHeight) / 2) - lineHeight;
  for (const line of lines) {
    page.drawText(line, { x: x + padding, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
};

const measureRowHeight = (cells, widths, font, size) => {
  const lineCount = Math.max(1, ...cells.map((cell, index) => (
    wrapText(cell, font, size, widths[index] - 10).length
  )));
  return Math.max(24, (lineCount * (size + 2)) + 10);
};

const measureFinalObservationsHeight = (text, font, width) => {
  const lineCount = Math.max(1, wrapText(text, font, 8.5, width - 16).length);
  return Math.max(46, 32 + (lineCount * 10));
};

const drawGridRow = ({ page, cells, widths, x, y, height, font, size, boldFont, bold = false, fill, colors, cellColors }) => {
  let cursorX = x;
  const activeFont = bold ? boldFont : font;
  for (let index = 0; index < cells.length; index += 1) {
    const rectangle = {
      x: cursorX,
      y: y - height,
      width: widths[index],
      height,
      borderColor: colors.ink,
      borderWidth: 0.75,
    };
    if (fill) rectangle.color = fill;
    page.drawRectangle(rectangle);
    drawCellText({ page, text: cells[index], font: activeFont, size, color: cellColors?.[index] || colors.ink, x: cursorX, y: y - height, width: widths[index], height });
    cursorX += widths[index];
  }
  return y - height;
};

const drawFinalObservations = ({ table, text, font, boldFont }) => {
  const width = A4.width - (PAGE_MARGIN * 2);
  const height = measureFinalObservationsHeight(text, font, width);
  const textX = PAGE_MARGIN + 8;
  const lines = wrapText(text, font, 8.5, width - 16);
  table.page.drawRectangle({
    x: PAGE_MARGIN,
    y: table.y - height,
    width,
    height,
    borderColor: table.colors.ink,
    borderWidth: 0.75,
  });
  table.page.drawText('OBSERVAÇÕES FINAIS', {
    x: textX,
    y: table.y - 14,
    size: 8.5,
    font: boldFont,
    color: table.colors.ink,
  });
  let y = table.y - 27;
  lines.forEach((line) => {
    table.page.drawText(line, { x: textX, y, size: 8.5, font, color: table.colors.ink });
    y -= 10;
  });
  return height;
};

const drawLetterheadWatermark = (page, letterheadPage) => {
  const scale = Math.min(A4.width / letterheadPage.width, A4.height / letterheadPage.height);
  const width = letterheadPage.width * scale;
  const height = letterheadPage.height * scale;
  page.drawPage(letterheadPage, {
    x: (A4.width - width) / 2,
    y: (A4.height - height) / 2,
    width,
    height,
    opacity: PA2_LETTERHEAD_OPACITY,
  });
};

const loadLetterheadPage = async (document) => {
  const letterheadUrl = new URL(`./${PA2_LETTERHEAD_PATH}`, import.meta.url);
  const response = await fetch(letterheadUrl);
  if (!response.ok) throw new Error('Não foi possível carregar o papel timbrado da MEGA.');
  const [letterheadPage] = await document.embedPdf(await response.arrayBuffer(), [0]);
  if (!letterheadPage) throw new Error('O papel timbrado da MEGA não possui uma página válida.');
  return letterheadPage;
};

const addTablePage = ({ document, font, boldFont, letterheadPage, plate, documentLabel, continuation = false }) => {
  const page = document.addPage([A4.width, A4.height]);
  drawLetterheadWatermark(page, letterheadPage);
  const colors = {
    ink: window.PDFLib.rgb(0.08, 0.08, 0.08),
    header: window.PDFLib.rgb(0.93, 0.93, 0.91),
    success: window.PDFLib.rgb(0.11, 0.47, 0.22),
  };
  const widths = [231, 92, A4.width - (PAGE_MARGIN * 2) - 323];
  let y = A4.height - PAGE_MARGIN;
  y = drawGridRow({ page, cells: [continuation ? 'MEGA DESPACHANTE (CONT.)' : 'MEGA DESPACHANTE', plate, documentLabel], widths, x: PAGE_MARGIN, y, height: 31, font, boldFont, bold: true, size: 11, colors });
  y = drawGridRow({ page, cells: ['DESCRIÇÃO', 'VALOR', 'OBSERVAÇÃO'], widths, x: PAGE_MARGIN, y, height: 23, font, boldFont, bold: true, size: 8.5, fill: colors.header, colors });
  return { page, y, widths, colors };
};

const appendImages = async (document, entries) => {
  let page = null;
  let cursorY = 0;
  let hasImageOnPage = false;
  const contentWidth = A4.width - (PAGE_MARGIN * 2);
  const contentHeight = A4.height - (PAGE_MARGIN * 2);

  for (const entry of entries) {
    const prepared = await prepareImageForPdf(entry, 'high');
    const image = await document.embedJpg(prepared.bytes);
    let scale = contentWidth / prepared.width;
    let width = prepared.width * scale;
    let height = prepared.height * scale;
    if (height > contentHeight) {
      scale = contentHeight / prepared.height;
      width = prepared.width * scale;
      height = prepared.height * scale;
    }

    if (!page || (hasImageOnPage && cursorY - height < PAGE_MARGIN)) {
      page = document.addPage([A4.width, A4.height]);
      cursorY = A4.height - PAGE_MARGIN;
      hasImageOnPage = false;
    }
    page.drawImage(image, { x: (A4.width - width) / 2, y: cursorY - height, width, height });
    cursorY -= height;
    hasImageOnPage = true;
  }
};

export const createPa2Pdf = async ({ entries, plate = '', documentLabel = '', date = '', rows = [], finalObservations = '' }) => {
  if (!window.PDFLib?.PDFDocument) throw new Error('Biblioteca de PDF indisponível. Atualize a página e tente novamente.');
  if (!isValidPa2ImageCount(entries.length)) throw new Error('Adicione de 1 a 10 imagens para gerar o PA2.');

  const { PDFDocument, StandardFonts } = window.PDFLib;
  const document = await PDFDocument.create();
  document.setTitle('PA2 - MEGA Despachante');
  document.setCreator('MEGA Despachante');
  await appendImages(document, entries);

  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const letterheadPage = await loadLetterheadPage(document);
  const normalizedDocumentLabel = normalizePa2DocumentLabel(documentLabel);
  let table = addTablePage({ document, font, boldFont, letterheadPage, plate: plate.toUpperCase(), documentLabel: normalizedDocumentLabel });
  const fontSize = 8;
  const bottomLimit = PAGE_MARGIN + 34;
  const bothFinesFilled = Number.isFinite(parseCurrencyValue(rows[PA2_ROWS.indexOf('Multas')]?.amount))
    && Number.isFinite(parseCurrencyValue(rows[PA2_ROWS.indexOf('Multas em estado de autuação')]?.amount));
  const finesSummaryText = bothFinesFilled
    ? `SOMA DE MULTAS + MULTAS EM ESTADO DE AUTUAÇÃO: ${formatCurrencyValue(calculatePa2FinesTotal(rows))}`
    : '';
  const normalizedRows = PA2_ROWS.map((description, index) => {
    const parsedAmount = parseCurrencyValue(rows[index]?.amount);
    const userNote = rows[index]?.note || '';
    const note = description === 'Multas em estado de autuação' && finesSummaryText
      ? [userNote, finesSummaryText].filter(Boolean).join(' — ')
      : userNote;
    return {
      description,
      amount: Number.isFinite(parsedAmount) ? formatCurrencyValue(parsedAmount) : '',
      note,
      parsedAmount,
    };
  });

  for (const row of normalizedRows) {
    const cells = [row.description.toUpperCase(), row.amount, row.note];
    const height = measureRowHeight(cells, table.widths, font, fontSize);
    if (table.y - height < bottomLimit) {
      table = addTablePage({ document, font, boldFont, letterheadPage, plate: plate.toUpperCase(), documentLabel: normalizedDocumentLabel, continuation: true });
    }
    const cellColors = row.description === 'Multas em estado de autuação' && finesSummaryText
      ? [undefined, undefined, table.colors.success]
      : undefined;
    table.y = drawGridRow({ ...table, cells, x: PAGE_MARGIN, height, font, boldFont, size: fontSize, cellColors });
  }

  const parsedValues = normalizedRows.map((row) => row.parsedAmount).filter(Number.isFinite);
  const total = parsedValues.length ? formatCurrencyValue(parsedValues.reduce((sum, value) => sum + value, 0)) : '';
  const formattedDate = date ? date.split('-').reverse().join('/') : '';
  const totalCells = ['TOTAL', total, formattedDate];
  const totalHeight = 31;
  const finalObservationsText = String(finalObservations || '').trim();
  const finalObservationsHeight = finalObservationsText
    ? measureFinalObservationsHeight(finalObservationsText, font, A4.width - (PAGE_MARGIN * 2))
    : 0;
  if (table.y - totalHeight - finalObservationsHeight < PAGE_MARGIN) {
    table = addTablePage({ document, font, boldFont, letterheadPage, plate: plate.toUpperCase(), documentLabel: normalizedDocumentLabel, continuation: true });
  }
  table.y = drawGridRow({ ...table, cells: totalCells, x: PAGE_MARGIN, height: totalHeight, font, boldFont, bold: true, size: 11, fill: table.colors.header });
  if (finalObservationsText) {
    table.y -= drawFinalObservations({ table, text: finalObservationsText, font, boldFont });
  }

  return document.save({ useObjectStreams: true });
};

const formatPa2MobileDate = (value) => (
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value).split('-').reverse().join('/')
    : ''
);

const measureCompactRowHeight = (cells, widths, font, size) => {
  const lineCount = Math.max(1, ...cells.map((cell, index) => (
    wrapText(cell, font, size, widths[index] - 8).length
  )));
  return Math.max(17, (lineCount * (size + 1.5)) + 6);
};

const addMobileTablePage = ({ document, font, boldFont, letterheadPage, continuation = false }) => {
  const page = document.addPage();
  page.setSize(A4.width, A4.height);
  drawLetterheadWatermark(page, letterheadPage);
  const colors = {
    ink: window.PDFLib.rgb(0.07, 0.07, 0.07),
    header: window.PDFLib.rgb(0.91, 0.91, 0.89),
  };
  const widths = [247, 114, A4.width - (PAGE_MARGIN * 2) - 361];
  let y = A4.height - PAGE_MARGIN;
  y = drawGridRow({
    page,
    cells: [continuation ? 'PA2 MOBILE - MEGA DESPACHANTE (CONT.)' : 'PA2 MOBILE - MEGA DESPACHANTE', '', ''],
    widths,
    x: PAGE_MARGIN,
    y,
    height: 27,
    font,
    boldFont,
    bold: true,
    size: 10,
    fill: colors.header,
    colors,
  });
  y = drawGridRow({
    page,
    cells: ['INFORMAÇÃO', 'VALOR', 'STATUS / OBSERVAÇÃO'],
    widths,
    x: PAGE_MARGIN,
    y,
    height: 18,
    font,
    boldFont,
    bold: true,
    size: 7.5,
    fill: colors.header,
    colors,
  });
  return { page, y, widths, colors, document, font, boldFont, letterheadPage };
};

const addMobilePdfRow = (table, cells, { bold = false, fill, size = 7.5 } = {}) => {
  const height = measureCompactRowHeight(cells, table.widths, table.font, size);
  let activeTable = table;
  if (activeTable.y - height < PAGE_MARGIN) {
    activeTable = addMobileTablePage({
      document: activeTable.document,
      font: activeTable.font,
      boldFont: activeTable.boldFont,
      letterheadPage: activeTable.letterheadPage,
      continuation: true,
    });
  }
  activeTable.y = drawGridRow({
    ...activeTable,
    cells,
    x: PAGE_MARGIN,
    height,
    font: activeTable.font,
    boldFont: activeTable.boldFont,
    bold,
    size,
    fill,
  });
  return activeTable;
};

const addMobilePdfSection = (table, title) => addMobilePdfRow(table, [title, '', ''], {
  bold: true,
  fill: table.colors.header,
  size: 7.5,
});

const mobileChecked = (value) => (value ? 'X' : '');

const mobileAmount = (value) => {
  const parsed = parseCurrencyValue(value);
  return Number.isFinite(parsed) ? formatCurrencyValue(parsed) : '';
};

const mobileStatus = (data, row) => (
  row.statusName && data[row.statusName] ? row.statusLabel : ''
);

const mobileStatusAndNotes = (data, row) => [
  mobileStatus(data, row),
  getMobilePa2NotesForTarget(data, row.name),
].filter(Boolean).join(' • ');

export const createMobilePa2Pdf = async ({ data = {} } = {}) => {
  if (!window.PDFLib?.PDFDocument) throw new Error('Biblioteca de PDF indisponível. Atualize a página e tente novamente.');

  const { PDFDocument, StandardFonts } = window.PDFLib;
  const document = await PDFDocument.create();
  document.setTitle('PA2 Mobile - MEGA Despachante');
  document.setCreator('MEGA Despachante');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const letterheadPage = await loadLetterheadPage(document);
  let table = addMobileTablePage({ document, font, boldFont, letterheadPage });

  table = addMobilePdfSection(table, 'DADOS DO VEÍCULO');
  MOBILE_PA2_TEXT_FIELDS.forEach((field) => {
    const value = field.type === 'date' ? formatPa2MobileDate(data[field.name]) : String(data[field.name] || '');
    table = addMobilePdfRow(table, [field.label.toUpperCase(), value.toUpperCase(), '']);
  });

  table = addMobilePdfSection(table, 'DOCUMENTAÇÃO');
  const documentRows = MOBILE_PA2_DOCUMENT_FIELDS.filter((field) => (
    !['ipvaParcelado', 'multasEmitidasNc', 'multasNaoEmitidasNc', 'gravameStatus'].includes(field.name)
  ));
  documentRows.forEach((field) => {
    const value = field.type === 'radio' ? String(data[field.name] || '') : mobileChecked(data[field.name]);
    table = addMobilePdfRow(table, [field.label.toUpperCase(), value.toUpperCase(), field.type === 'checkbox' && value ? 'MARCADO' : '']);
  });

  table = addMobilePdfSection(table, 'GRAVAME');
  const gravame = MOBILE_PA2_VALUE_ROWS.find((row) => row.name === 'gravame');
  table = addMobilePdfRow(table, [gravame.label.toUpperCase(), mobileAmount(data[gravame.name]), String(data.gravameStatus || '').toUpperCase()]);
  if (data.gravameStatus === 'Ativo') {
    table = addMobilePdfRow(table, ['GRAVAME ATIVO ATÉ', formatPa2MobileDate(data.gravameAtivoAte), '']);
  }

  table = addMobilePdfSection(table, 'IPVA / LICENCIAMENTO');
  MOBILE_PA2_VALUE_ROWS.filter((row) => ['ipva', 'licenciamento'].includes(row.name)).forEach((row) => {
    table = addMobilePdfRow(table, [row.label.toUpperCase(), mobileAmount(data[row.name]), mobileStatusAndNotes(data, row).toUpperCase()]);
  });

  table = addMobilePdfSection(table, 'MULTAS');
  MOBILE_PA2_VALUE_ROWS.filter((row) => ['multasEmitidas', 'multasNaoEmitidas'].includes(row.name)).forEach((row) => {
    table = addMobilePdfRow(table, [row.label.toUpperCase(), mobileAmount(data[row.name]), mobileStatusAndNotes(data, row).toUpperCase()]);
  });

  table = addMobilePdfSection(table, 'SERVIÇOS DETRAN');
  MOBILE_PA2_VALUE_ROWS.filter((row) => row.group === 'services').forEach((row) => {
    table = addMobilePdfRow(table, [row.label.toUpperCase(), mobileAmount(data[row.name]), '']);
  });

  table = addMobilePdfSection(table, 'CND');
  table = addMobilePdfRow(table, [
    'EMITIDA VÁLIDA ATÉ',
    formatPa2MobileDate(data.cndValidade),
    data.cndNaoConsta ? 'NÃO CONSTA CND EMITIDA / VÁLIDA' : '',
  ]);

  table = addMobilePdfRow(table, ['TOTAL GERAL DO PA2', formatCurrencyValue(calculateMobilePa2Total(data)), ''], {
    bold: true,
    fill: table.colors.header,
    size: 8.5,
  });
  table = addMobilePdfRow(table, ['OBSERVAÇÕES', '', getMobilePa2NotesForTarget(data, 'general')], { bold: true });

  return document.save({ useObjectStreams: true });
};

const PA2_MODE_COPY = Object.freeze({
  saga: {
    kicker: 'PA2 PADRÃO SAGA',
    title: 'Imagens e despesas.<br /><em>Um único PDF organizado.</em>',
    description: 'Adicione de 1 a 10 imagens, organize a sequência e preencha somente as informações que desejar. Os campos não preenchidos ficarão em branco.',
  },
  mobile: {
    kicker: 'PA2 PADRÃO MOBILE',
    title: 'Ficha completa do veículo.<br /><em>Pronta para o atendimento.</em>',
    description: 'Preencha os dados do veículo, documentação, débitos e serviços. O PDF seguirá o padrão da tabela PA2 Mobile.',
  },
});

const selectPa2Model = (model) => {
  const activeModel = PA2_MODE_COPY[model] ? model : 'saga';
  const copy = PA2_MODE_COPY[activeModel];
  document.body.dataset.pa2Mode = activeModel;
  document.querySelectorAll('[data-pa2-model]').forEach((panel) => {
    panel.hidden = panel.dataset.pa2Model !== activeModel;
  });
  document.querySelectorAll('[data-pa2-guide]').forEach((guide) => {
    guide.hidden = guide.dataset.pa2Guide !== activeModel;
  });
  const kicker = document.getElementById('pa2-model-kicker');
  const title = document.getElementById('pa2-model-title');
  const description = document.getElementById('pa2-model-description');
  if (kicker) kicker.innerHTML = `<span></span> ${copy.kicker}`;
  if (title) title.innerHTML = copy.title;
  if (description) description.textContent = copy.description;
};

const initPa2Gate = () => {
  const gate = document.getElementById('pa2-gate');
  const gateForm = document.getElementById('pa2-gate-form');
  const gateInput = document.getElementById('pa2-gate-input');
  const gateError = document.getElementById('pa2-gate-error');
  const passwordPanel = document.getElementById('pa2-gate-password');
  const modelSelector = document.getElementById('pa2-model-selector');
  const changeModelButton = document.getElementById('pa2-change-model');
  if (!gate || !gateForm || !gateInput) return;

  const showModelSelector = () => {
    if (passwordPanel) passwordPanel.hidden = true;
    if (modelSelector) modelSelector.hidden = false;
    const firstChoice = modelSelector?.querySelector('[data-pa2-choice]');
    firstChoice?.focus();
  };

  const unlock = (model) => {
    selectPa2Model(model);
    document.body.classList.remove('pa2-locked');
    gate.hidden = true;
  };

  modelSelector?.querySelectorAll('[data-pa2-choice]').forEach((choice) => {
    choice.addEventListener('click', () => unlock(choice.dataset.pa2Choice));
  });

  changeModelButton?.addEventListener('click', () => {
    document.body.classList.add('pa2-locked');
    gate.hidden = false;
    showModelSelector();
  });

  try {
    if (document.body.dataset.pa2AccessGranted === 'true' || sessionStorage.getItem(PA2_ACCESS_STORAGE_KEY) === 'true') {
      showModelSelector();
      return;
    }
  } catch {
    // sessionStorage indisponível (modo privado, etc.); segue pedindo o código normalmente.
  }

  gateInput.focus();
  gateInput.addEventListener('input', () => {
    if (gateError) gateError.hidden = true;
  });

  gateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const entered = gateInput.value.trim().toLowerCase();
    const expected = PA2_ACCESS_CODE.trim().toLowerCase();
    if (entered && entered === expected) {
      try {
        sessionStorage.setItem(PA2_ACCESS_STORAGE_KEY, 'true');
      } catch {
        // Sem sessionStorage disponível: libera o acesso só para esta interação.
      }
      showModelSelector();
      return;
    }
    if (gateError) gateError.hidden = false;
    gateInput.select();
  });
};

const initSagaPa2 = () => {
  const form = document.getElementById('pa2-form');
  const input = document.getElementById('pa2-image-input');
  const dropzone = document.getElementById('pa2-dropzone');
  const list = document.getElementById('pa2-image-list');
  const count = document.getElementById('pa2-count');
  const message = document.getElementById('pa2-image-message');
  const tableBody = document.getElementById('pa2-table-body');
  const generateButton = document.getElementById('pa2-generate');
  const actionNote = document.getElementById('pa2-action-note');
  const result = document.getElementById('pa2-result');
  const clearDocumentButton = document.getElementById('pa2-clear-document');
  const clearDataButton = document.getElementById('pa2-clear-data');
  if (!form || !input || !dropzone || !list || !tableBody || !generateButton) return;

  let entries = [];
  let multasAmountInput = null;
  let autuacaoAmountInput = null;
  let autuacaoNoteInput = null;

  PA2_ROWS.forEach((description, index) => {
    const row = document.createElement('tr');
    const descriptionCell = document.createElement('th');
    descriptionCell.scope = 'row';
    descriptionCell.textContent = description;
    const amountCell = document.createElement('td');
    const amount = document.createElement('input');
    amount.name = `amount-${index}`;
    amount.inputMode = 'decimal';
    amount.maxLength = 18;
    amount.placeholder = 'R$ 0,00';
    amount.setAttribute('aria-label', `Valor de ${description}`);
    const amountPreview = document.createElement('small');
    amountPreview.className = 'pa2-amount-preview';
    amountPreview.setAttribute('aria-live', 'polite');
    amount.addEventListener('input', () => {
      const parsed = parseCurrencyValue(amount.value);
      amountPreview.textContent = Number.isFinite(parsed) ? `= ${formatCurrencyValue(parsed)}` : '';
    });
    const noteCell = document.createElement('td');
    const note = document.createElement('input');
    note.name = `note-${index}`;
    note.maxLength = 180;
    note.placeholder = 'Observação';
    note.setAttribute('aria-label', `Observação de ${description}`);
    amountCell.append(amount, amountPreview);
    noteCell.append(note);
    row.append(descriptionCell, amountCell, noteCell);
    tableBody.append(row);
    if (description === 'Multas') multasAmountInput = amount;
    if (description === 'Multas em estado de autuação') {
      autuacaoAmountInput = amount;
      autuacaoNoteInput = note;
    }
  });

  const updateFinesNoteLock = () => {
    if (!multasAmountInput || !autuacaoAmountInput || !autuacaoNoteInput) return;
    const bothFinesFilled = Number.isFinite(parseCurrencyValue(multasAmountInput.value))
      && Number.isFinite(parseCurrencyValue(autuacaoAmountInput.value));
    autuacaoNoteInput.disabled = bothFinesFilled;
    autuacaoNoteInput.placeholder = bothFinesFilled
      ? 'Preenchido automaticamente com a soma das multas'
      : 'Observação';
    if (bothFinesFilled) autuacaoNoteInput.value = '';
  };
  multasAmountInput?.addEventListener('input', updateFinesNoteLock);
  autuacaoAmountInput?.addEventListener('input', updateFinesNoteLock);

  const setMessage = (text = '', type = '') => {
    message.textContent = text;
    message.className = `pa2-message${type ? ` pa2-message--${type}` : ''}`;
  };

  const updateState = () => {
    count.textContent = `${entries.length} / ${MAX_PA2_IMAGES}`;
    const validCount = isValidPa2ImageCount(entries.length);
    generateButton.disabled = !validCount;
    actionNote.textContent = validCount
      ? `${entries.length} imagens serão colocadas antes da tabela.`
      : `Adicione mais ${Math.max(0, MIN_PA2_IMAGES - entries.length)} ${MIN_PA2_IMAGES - entries.length === 1 ? 'imagem' : 'imagens'} para gerar o documento.`;
    dropzone.classList.toggle('is-full', entries.length >= MAX_PA2_IMAGES);
  };

  const releaseEntry = (entry) => URL.revokeObjectURL(entry.previewUrl);

  const moveEntry = (id, direction) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    renderList();
  };

  const makeButton = (label, text, handler, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.textContent = text;
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  };

  const renderList = () => {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      const order = document.createElement('span');
      order.className = 'pa2-image-order';
      order.textContent = String(index + 1).padStart(2, '0');
      const preview = document.createElement('span');
      preview.className = 'pa2-image-preview';
      const image = document.createElement('img');
      image.src = entry.previewUrl;
      image.alt = '';
      image.style.transform = `rotate(${entry.rotation}deg)`;
      preview.append(image);
      const copy = document.createElement('div');
      copy.className = 'pa2-image-copy';
      const name = document.createElement('strong');
      name.textContent = entry.file.name;
      const metadata = document.createElement('small');
      metadata.textContent = `${entry.width} × ${entry.height} px · ${formatImageBytes(entry.file.size)}`;
      copy.append(name, metadata);
      const controls = document.createElement('div');
      controls.className = 'pa2-image-controls';
      controls.append(
        makeButton(`Mover ${entry.file.name} para cima`, '↑', () => moveEntry(entry.id, -1), index === 0),
        makeButton(`Mover ${entry.file.name} para baixo`, '↓', () => moveEntry(entry.id, 1), index === entries.length - 1),
        makeButton(`Girar ${entry.file.name}`, '↻', () => {
          entry.rotation = (entry.rotation + 90) % 360;
          renderList();
        }),
        makeButton(`Remover ${entry.file.name}`, '×', () => {
          releaseEntry(entry);
          entries = entries.filter((candidate) => candidate.id !== entry.id);
          setMessage(`${entry.file.name} foi removida.`, 'info');
          renderList();
        }),
      );
      item.append(order, preview, copy, controls);
      list.append(item);
    });
    updateState();
  };

  const addFiles = async (fileList, source = 'selection') => {
    const candidates = [...fileList];
    if (!candidates.length) return;
    setMessage('Conferindo as imagens...', 'loading');
    let added = 0;
    const errors = [];

    for (const file of candidates) {
      if (entries.length >= MAX_PA2_IMAGES) {
        errors.push(`O limite é de ${MAX_PA2_IMAGES} imagens.`);
        break;
      }
      const acceptedExtension = /\.(jpe?g|png)$/i.test(file.name);
      if (!ACCEPTED_TYPES.has(file.type) && !acceptedExtension) {
        errors.push(`${file.name}: use JPG ou PNG.`);
        continue;
      }
      if (entries.some((entry) => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) {
        errors.push(`${file.name}: imagem já adicionada.`);
        continue;
      }
      const currentBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
      if (currentBytes + file.size > MAX_TOTAL_BYTES) {
        errors.push(`${file.name}: o conjunto ultrapassaria 40 MB.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        const image = await createBrowserImage(file, previewUrl);
        entries.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, previewUrl, width: image.naturalWidth, height: image.naturalHeight, rotation: 0 });
        image.src = '';
        added += 1;
      } catch {
        URL.revokeObjectURL(previewUrl);
        errors.push(`${file.name}: não foi possível ler a imagem.`);
      }
    }

    input.value = '';
    renderList();
    if (errors.length) setMessage(errors.join(' '), 'error');
    else if (source === 'clipboard') setMessage(`${added} ${added === 1 ? 'imagem colada' : 'imagens coladas'} com sucesso.`, 'success');
    else setMessage(`${added} ${added === 1 ? 'imagem adicionada' : 'imagens adicionadas'} com sucesso.`, 'success');
  };

  dropzone.addEventListener('click', () => {
    if (entries.length < MAX_PA2_IMAGES) input.click();
  });
  dropzone.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && entries.length < MAX_PA2_IMAGES) {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => void addFiles(input.files));
  ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
  }));
  dropzone.addEventListener('drop', (event) => void addFiles(event.dataTransfer.files));
  document.addEventListener('paste', (event) => {
    if (document.body.dataset.pa2Mode !== 'saga') return;
    const clipboardImages = getPa2ClipboardImages(event.clipboardData);
    if (!clipboardImages.length) return;
    event.preventDefault();
    const pastedAt = Date.now();
    const namedImages = clipboardImages.map((file, index) => {
      const extension = file.type === 'image/jpeg' ? 'jpg' : 'png';
      return new File([file], `imagem-colada-${pastedAt}-${index + 1}.${extension}`, {
        type: file.type,
        lastModified: pastedAt + index,
      });
    });
    void addFiles(namedImages, 'clipboard');
  });
  clearDocumentButton?.addEventListener('click', () => {
    form.querySelectorAll('input[name="documentType"]').forEach((option) => {
      option.checked = false;
    });
  });
  clearDataButton?.addEventListener('click', () => {
    if (!window.confirm('Limpar todos os dados do PA2? As imagens e os campos preenchidos serão apagados.')) return;

    entries.forEach(releaseEntry);
    entries = [];
    form.reset();
    input.value = '';
    result.hidden = true;
    result.textContent = '';
    result.classList.remove('pa2-result--error');
    setMessage('Todos os dados do PA2 foram limpos.', 'success');
    renderList();
    updateFinesNoteLock();
    dropzone.focus();
  });

  const generatePa2Pdf = async () => {
    generateButton.disabled = true;
    generateButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Montando o PDF...';
    result.classList.remove('pa2-result--error');
    result.hidden = true;

    try {
      const rows = PA2_ROWS.map((_, index) => ({
        amount: form.elements[`amount-${index}`].value.trim(),
        note: form.elements[`note-${index}`].value.trim(),
      }));
      const pdfBytes = await createPa2Pdf({
        entries,
        plate: form.elements.plate.value.trim(),
        documentLabel: form.elements.documentType.value,
        date: form.elements.date.value,
        rows,
        finalObservations: form.elements.finalObservations.value.trim(),
      });
      const filename = normalizeFilename(form.elements.filename.value);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const download = document.createElement('a');
      download.href = url;
      download.download = filename;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      result.textContent = `${filename} foi criado com ${entries.length} imagens e a tabela ao final.`;
      result.hidden = false;
    } catch (error) {
      result.textContent = error?.message || 'Não foi possível gerar o PA2. Tente novamente.';
      result.classList.add('pa2-result--error');
      result.hidden = false;
    } finally {
      generateButton.innerHTML = 'Gerar e baixar PA2 <span>→</span>';
      updateState();
    }
  };

  // Modal de última conferência, no mesmo estilo usado nos demais formulários
  // do site (classes premium-modal / premium-review-*, já globais no styles.css).
  const reviewModal = document.createElement('div');
  reviewModal.className = 'premium-modal premium-review-modal';
  reviewModal.hidden = true;
  reviewModal.setAttribute('role', 'dialog');
  reviewModal.setAttribute('aria-modal', 'true');
  reviewModal.setAttribute('aria-labelledby', 'pa2-review-title');
  reviewModal.innerHTML = '<div class="premium-modal-backdrop" data-modal-close></div><div class="premium-modal-panel" role="document"></div>';
  document.body.append(reviewModal);
  const reviewPanel = reviewModal.querySelector('.premium-modal-panel');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const closeReview = () => {
    reviewModal.classList.remove('is-open');
    document.body.classList.remove('premium-modal-open');
    window.setTimeout(() => {
      reviewModal.hidden = true;
    }, reduceMotion ? 0 : 180);
  };
  reviewModal.querySelector('[data-modal-close]').addEventListener('click', closeReview);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !reviewModal.hidden) closeReview();
  });

  const buildReviewRows = () => {
    const rows = PA2_ROWS.map((_, index) => ({
      amount: form.elements[`amount-${index}`].value.trim(),
      note: form.elements[`note-${index}`].value.trim(),
    }));
    const bothFinesFilled = Number.isFinite(parseCurrencyValue(rows[PA2_ROWS.indexOf('Multas')]?.amount))
      && Number.isFinite(parseCurrencyValue(rows[PA2_ROWS.indexOf('Multas em estado de autuação')]?.amount));
    const finesSummaryText = bothFinesFilled
      ? `SOMA DE MULTAS + MULTAS EM ESTADO DE AUTUAÇÃO: ${formatCurrencyValue(calculatePa2FinesTotal(rows))}`
      : '';
    return PA2_ROWS.map((description, index) => {
      const parsedAmount = parseCurrencyValue(rows[index].amount);
      const note = description === 'Multas em estado de autuação' && finesSummaryText
        ? [rows[index].note, finesSummaryText].filter(Boolean).join(' — ')
        : rows[index].note;
      return { description, amount: Number.isFinite(parsedAmount) ? formatCurrencyValue(parsedAmount) : '', note };
    });
  };

  const showReview = () => {
    const formattedDate = form.elements.date.value
      ? form.elements.date.value.split('-').reverse().join('/')
      : '';
    const documentItems = [
      { label: 'Placa', value: form.elements.plate.value.trim().toUpperCase() },
      { label: 'Tipo de documento', value: form.elements.documentType.value },
      { label: 'Data', value: formattedDate },
      { label: 'Nome do arquivo', value: normalizeFilename(form.elements.filename.value) },
    ].filter((item) => item.value);
    const expenseItems = buildReviewRows()
      .filter((row) => row.amount || row.note)
      .map((row) => ({ label: row.description, value: [row.amount, row.note].filter(Boolean).join(' — ') }));
    const finalObservationsText = form.elements.finalObservations.value.trim();

    const groups = [
      { title: 'Imagens', items: [{ label: 'Imagens anexadas', value: `${entries.length} ${entries.length === 1 ? 'imagem' : 'imagens'}` }] },
      { title: 'Documento', items: documentItems },
      { title: 'Despesas', items: expenseItems },
      { title: 'Observações finais', items: finalObservationsText ? [{ label: 'Texto', value: finalObservationsText }] : [] },
    ].filter((group) => group.items.length);

    reviewPanel.innerHTML = `
      <div class="premium-modal-header">
        <span class="premium-modal-icon" aria-hidden="true">✓</span>
        <div>
          <span class="premium-kicker">ÚLTIMA CONFERÊNCIA</span>
          <h2 id="pa2-review-title">Revise antes de gerar</h2>
          <p>Confira os dados do PA2. Se algo estiver errado, feche e ajuste.</p>
        </div>
        <button type="button" class="premium-modal-close" aria-label="Fechar revisão">×</button>
      </div>
      <div class="premium-review-groups"></div>
      <div class="premium-modal-actions">
        <button type="button" class="premium-nav-button premium-review-edit"><span aria-hidden="true">←</span> Continuar editando</button>
        <button type="button" class="button button-primary premium-review-confirm">Confirmar e gerar PDF <span aria-hidden="true">→</span></button>
      </div>
    `;

    const groupsContainer = reviewPanel.querySelector('.premium-review-groups');
    groups.forEach((group, groupIndex) => {
      const section = document.createElement('section');
      section.className = 'premium-review-group';
      const heading = document.createElement('h3');
      heading.innerHTML = `<span>${String(groupIndex + 1).padStart(2, '0')}</span>${group.title}`;
      section.append(heading);
      const dl = document.createElement('dl');
      group.items.forEach((item) => {
        const wrapper = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = item.label;
        description.textContent = item.value;
        wrapper.append(term, description);
        dl.append(wrapper);
      });
      section.append(dl);
      groupsContainer.append(section);
    });

    reviewPanel.querySelector('.premium-modal-close').addEventListener('click', closeReview);
    reviewPanel.querySelector('.premium-review-edit').addEventListener('click', closeReview);
    const confirmButton = reviewPanel.querySelector('.premium-review-confirm');
    confirmButton.addEventListener('click', () => {
      closeReview();
      void generatePa2Pdf();
    });

    reviewModal.hidden = false;
    document.body.classList.add('premium-modal-open');
    window.requestAnimationFrame(() => {
      reviewModal.classList.add('is-open');
      confirmButton.focus();
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isValidPa2ImageCount(entries.length)) {
      setMessage('Adicione de 1 a 10 imagens antes de gerar o PA2.', 'error');
      return;
    }
    showReview();
  });

  window.addEventListener('beforeunload', () => entries.forEach(releaseEntry));
  updateState();
};

const readMobilePa2Data = (form) => {
  const data = {};
  MOBILE_PA2_TEXT_FIELDS.forEach((field) => {
    data[field.name] = form.elements[field.name]?.value.trim() || '';
  });
  MOBILE_PA2_DOCUMENT_FIELDS.forEach((field) => {
    if (field.type === 'checkbox') {
      data[field.name] = Boolean(form.elements[field.name]?.checked);
      return;
    }
    data[field.name] = form.querySelector(`input[name="${field.name}"]:checked`)?.value || '';
  });
  MOBILE_PA2_VALUE_ROWS.forEach((row) => {
    data[row.name] = form.elements[row.name]?.value.trim() || '';
  });
  data.gravameAtivoAte = form.elements.gravameAtivoAte?.value || '';
  if (data.gravameStatus !== 'Ativo') data.gravameAtivoAte = '';
  data.cndValidade = form.elements.cndValidade?.value || '';
  data.cndNaoConsta = Boolean(form.elements.cndNaoConsta?.checked);
  try {
    data.mobileNotes = normalizeMobilePa2Notes(JSON.parse(form.elements.mobileNotes?.value || '[]'));
  } catch {
    data.mobileNotes = [];
  }
  return data;
};

const initMobilePa2 = () => {
  const form = document.getElementById('pa2-mobile-form');
  const vehicleFields = document.getElementById('pa2-mobile-vehicle-fields');
  const documentFields = document.getElementById('pa2-mobile-document-fields');
  const debtFields = document.getElementById('pa2-mobile-debt-fields');
  const serviceFields = document.getElementById('pa2-mobile-service-fields');
  const cndFields = document.getElementById('pa2-mobile-cnd-fields');
  const generateButton = document.getElementById('pa2-mobile-generate');
  const clearButton = document.getElementById('pa2-mobile-clear-data');
  const result = document.getElementById('pa2-mobile-result');
  const notesData = document.getElementById('pa2-mobile-notes-data');
  const noteText = document.getElementById('pa2-mobile-note-text');
  const noteTarget = document.getElementById('pa2-mobile-note-target');
  const addNoteButton = document.getElementById('pa2-mobile-add-note');
  const notesFeedback = document.getElementById('pa2-mobile-notes-feedback');
  const notesList = document.getElementById('pa2-mobile-notes-list');
  if (!form || !vehicleFields || !documentFields || !debtFields || !serviceFields || !cndFields || !generateButton || !notesData || !noteText || !noteTarget || !addNoteButton || !notesFeedback || !notesList) return;

  let mobileNotes = [];
  const setNotesFeedback = (message = '') => {
    notesFeedback.textContent = message;
    notesFeedback.hidden = !message;
  };
  const renderMobileNotes = () => {
    notesData.value = JSON.stringify(mobileNotes);
    notesList.replaceChildren();
    mobileNotes.forEach((note, index) => {
      const item = document.createElement('li');
      const copy = document.createElement('span');
      const target = document.createElement('strong');
      target.textContent = MOBILE_PA2_NOTE_TARGETS[note.target];
      const text = document.createElement('span');
      text.textContent = note.text;
      copy.append(target, text);
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remover';
      removeButton.setAttribute('aria-label', `Remover observação de ${MOBILE_PA2_NOTE_TARGETS[note.target]}`);
      removeButton.addEventListener('click', () => {
        mobileNotes.splice(index, 1);
        renderMobileNotes();
        setNotesFeedback('Observação removida.');
      });
      item.append(copy, removeButton);
      notesList.append(item);
    });
  };
  addNoteButton.addEventListener('click', () => {
    const text = noteText.value.trim();
    const target = noteTarget.value;
    if (!text) {
      setNotesFeedback('Digite uma observação antes de salvar.');
      noteText.focus();
      return;
    }
    mobileNotes.push({ target, text: text.slice(0, 300) });
    renderMobileNotes();
    noteText.value = '';
    setNotesFeedback(`Observação salva em ${MOBILE_PA2_NOTE_TARGETS[target]}.`);
    noteText.focus();
  });
  renderMobileNotes();

  MOBILE_PA2_TEXT_FIELDS.forEach((field) => {
    const label = document.createElement('label');
    label.textContent = field.label;
    const input = document.createElement('input');
    input.name = field.name;
    input.type = field.type || 'text';
    input.maxLength = field.maxlength || 100;
    input.autocomplete = 'off';
    if (field.uppercase) input.className = 'pa2-mobile-uppercase';
    label.append(input);
    vehicleFields.append(label);
  });

  let gravameChoiceGroup;
  MOBILE_PA2_DOCUMENT_FIELDS.filter((field) => !['ipvaParcelado', 'multasEmitidasNc', 'multasNaoEmitidasNc'].includes(field.name)).forEach((field) => {
    if (field.type === 'checkbox') {
      const label = document.createElement('label');
      label.className = 'pa2-mobile-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = field.name;
      const text = document.createElement('span');
      text.textContent = field.label;
      label.append(input, text);
      documentFields.append(label);
      return;
    }
    const group = document.createElement('fieldset');
    group.className = 'pa2-mobile-choice-group';
    const legend = document.createElement('legend');
    legend.textContent = field.label;
    const options = document.createElement('div');
    field.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'pa2-mobile-check';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = field.name;
      input.value = option;
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, text);
      options.append(label);
    });
    group.append(legend, options);
    documentFields.append(group);
    if (field.name === 'gravameStatus') gravameChoiceGroup = group;
  });

  const addValueField = (container, row) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'pa2-mobile-value-row';
    const label = document.createElement('label');
    label.textContent = row.label;
    const input = document.createElement('input');
    input.name = row.name;
    input.type = row.type === 'number' ? 'number' : 'text';
    input.inputMode = row.type === 'number' ? 'numeric' : 'decimal';
    input.min = row.type === 'number' ? '0' : '';
    input.maxLength = row.type === 'number' ? 4 : 18;
    input.autocomplete = 'off';
    input.placeholder = row.type === 'number' ? '0' : 'R$ 0,00';
    const preview = document.createElement('small');
    preview.className = 'pa2-amount-preview';
    preview.setAttribute('aria-live', 'polite');
    label.append(input, preview);
    wrapper.append(label);
    if (row.statusName) {
      const status = document.createElement('label');
      status.className = 'pa2-mobile-check pa2-mobile-inline-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = row.statusName;
      const text = document.createElement('span');
      text.textContent = row.statusLabel;
      status.append(checkbox, text);
      wrapper.append(status);
    }
    input.addEventListener('input', () => {
      preview.textContent = row.type === 'number'
        ? ''
        : (Number.isFinite(parseCurrencyValue(input.value)) ? `= ${formatCurrencyValue(parseCurrencyValue(input.value))}` : '');
      updateTotal();
    });
    container.append(wrapper);
  };

  MOBILE_PA2_VALUE_ROWS.filter((row) => row.group === 'debts' && row.name !== 'gravame').forEach((row) => addValueField(debtFields, row));
  MOBILE_PA2_VALUE_ROWS.filter((row) => row.group === 'services').forEach((row) => addValueField(serviceFields, row));

  const gravameDetails = document.createElement('div');
  gravameDetails.className = 'pa2-mobile-gravame-details';
  gravameDetails.hidden = true;
  const gravameHint = document.createElement('p');
  gravameHint.textContent = 'Use o valor de referência de R$ 274,61 quando houver baixa de gravame.';
  const gravame = MOBILE_PA2_VALUE_ROWS.find((row) => row.name === 'gravame');
  addValueField(gravameDetails, gravame);
  const gravameUntilLabel = document.createElement('label');
  gravameUntilLabel.className = 'pa2-mobile-gravame-until';
  gravameUntilLabel.textContent = 'Gravame ativo até';
  const gravameUntil = document.createElement('input');
  gravameUntil.name = 'gravameAtivoAte';
  gravameUntil.type = 'date';
  gravameUntilLabel.append(gravameUntil);
  gravameDetails.append(gravameHint, gravameUntilLabel);
  documentFields.append(gravameDetails);

  const updateGravameFields = () => {
    const status = form.querySelector('input[name="gravameStatus"]:checked')?.value || '';
    gravameDetails.hidden = false;
    gravameUntilLabel.hidden = status !== 'Ativo';
  };
  gravameChoiceGroup?.querySelectorAll('input[name="gravameStatus"]').forEach((input) => {
    input.addEventListener('change', () => {
      updateGravameFields();
      updateTotal();
    });
  });
  updateGravameFields();

  const cndDateLabel = document.createElement('label');
  cndDateLabel.textContent = 'CND emitida válida até';
  const cndDate = document.createElement('input');
  cndDate.name = 'cndValidade';
  cndDate.type = 'date';
  cndDateLabel.append(cndDate);
  const cndMissingLabel = document.createElement('label');
  cndMissingLabel.className = 'pa2-mobile-check';
  const cndMissing = document.createElement('input');
  cndMissing.type = 'checkbox';
  cndMissing.name = 'cndNaoConsta';
  const cndMissingText = document.createElement('span');
  cndMissingText.textContent = 'Não consta CND emitida / válida';
  cndMissingLabel.append(cndMissing, cndMissingText);
  const totalPreview = document.createElement('output');
  totalPreview.id = 'pa2-mobile-live-total';
  totalPreview.className = 'pa2-mobile-total-preview';
  cndFields.append(cndDateLabel, cndMissingLabel, totalPreview);

  const updateTotal = () => {
    const data = readMobilePa2Data(form);
    totalPreview.textContent = `Total geral: ${formatCurrencyValue(calculateMobilePa2Total(data))}`;
  };
  updateTotal();

  clearButton?.addEventListener('click', () => {
    if (!window.confirm('Limpar todos os dados do PA2 Mobile?')) return;
    form.reset();
    mobileNotes = [];
    renderMobileNotes();
    setNotesFeedback('');
    result.hidden = true;
    result.textContent = '';
    result.classList.remove('pa2-result--error');
    form.querySelectorAll('.pa2-amount-preview').forEach((preview) => {
      preview.textContent = '';
    });
    updateGravameFields();
    updateTotal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    generateButton.disabled = true;
    generateButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Montando o PDF...';
    result.hidden = true;
    result.classList.remove('pa2-result--error');
    try {
      const data = readMobilePa2Data(form);
      const pdfBytes = await createMobilePa2Pdf({ data });
      const filename = normalizeFilename(data.placa ? `PA2 Mobile ${data.placa}` : 'PA2 Mobile', 'PA2 Mobile');
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const download = document.createElement('a');
      download.href = url;
      download.download = filename;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      result.textContent = `${filename} foi criado no padrão Mobile.`;
      result.hidden = false;
    } catch (error) {
      result.textContent = error?.message || 'Não foi possível gerar o PA2 Mobile. Tente novamente.';
      result.classList.add('pa2-result--error');
      result.hidden = false;
    } finally {
      generateButton.disabled = false;
      generateButton.innerHTML = 'Gerar e baixar PA2 Mobile <span>→</span>';
    }
  });
};

if (typeof document !== 'undefined') initPa2Gate();
if (typeof document !== 'undefined') initSagaPa2();
if (typeof document !== 'undefined') initMobilePa2();
