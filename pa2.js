import { formatImageBytes, prepareImageForPdf } from './imagens-para-pdf.js';

export const MIN_PA2_IMAGES = 3;
export const MAX_PA2_IMAGES = 6;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);
const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const PAGE_MARGIN = 28.35;

export const PA2_ROWS = Object.freeze([
  'Taxa de leasing',
  'Perícia e foto',
  'Desalienação',
  'Transferência de propriedade',
  '2ª via de recibo (DUT)',
  'Transferência de UF + município',
  'Multa',
  'Vistoria DETRAN',
  'Honorário despachante',
  'IPVA',
  'Placa',
  'Taxa RENAVE',
  'SEFAZ',
  'Benefício tributário',
  'Taxa ATPV-e',
]);

export const isValidPa2ImageCount = (count) => (
  Number.isInteger(count) && count >= MIN_PA2_IMAGES && count <= MAX_PA2_IMAGES
);

export const parseCurrencyValue = (value) => {
  const cleaned = String(value || '').trim().replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || !/\d/.test(cleaned)) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
};

export const formatCurrencyValue = (value) => {
  if (!Number.isFinite(value)) return '';
  const [integer, decimals] = value.toFixed(2).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${decimals}`;
};

const normalizeFilename = (value) => {
  const base = String(value || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  return `${base || 'PA2'}.pdf`;
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

const drawGridRow = ({ page, cells, widths, x, y, height, font, size, boldFont, bold = false, fill, colors }) => {
  let cursorX = x;
  const activeFont = bold ? boldFont : font;
  for (let index = 0; index < cells.length; index += 1) {
    page.drawRectangle({
      x: cursorX,
      y: y - height,
      width: widths[index],
      height,
      borderColor: colors.ink,
      borderWidth: 0.75,
      color: fill,
    });
    drawCellText({ page, text: cells[index], font: activeFont, size, color: colors.ink, x: cursorX, y: y - height, width: widths[index], height });
    cursorX += widths[index];
  }
  return y - height;
};

const addTablePage = ({ document, font, boldFont, plate, documentLabel, continuation = false }) => {
  const page = document.addPage([A4.width, A4.height]);
  const colors = {
    ink: window.PDFLib.rgb(0.08, 0.08, 0.08),
    header: window.PDFLib.rgb(0.93, 0.93, 0.91),
    white: window.PDFLib.rgb(1, 1, 1),
  };
  const widths = [231, 92, A4.width - (PAGE_MARGIN * 2) - 323];
  let y = A4.height - PAGE_MARGIN;
  y = drawGridRow({ page, cells: [continuation ? 'DESPACHANTE (CONT.)' : 'DESPACHANTE', plate, documentLabel], widths, x: PAGE_MARGIN, y, height: 31, font, boldFont, bold: true, size: 11, fill: colors.white, colors });
  y = drawGridRow({ page, cells: ['DESCRIÇÃO', 'VALOR', 'OBSERVAÇÃO'], widths, x: PAGE_MARGIN, y, height: 23, font, boldFont, bold: true, size: 8.5, fill: colors.header, colors });
  return { page, y, widths, colors };
};

const appendImages = async (document, entries) => {
  let page = null;
  let cursorY = 0;
  let hasImageOnPage = false;
  const contentWidth = A4.width - (PAGE_MARGIN * 2);
  const contentHeight = A4.height - (PAGE_MARGIN * 2);
  const gap = 12;

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
    cursorY -= height + gap;
    hasImageOnPage = true;
  }
};

export const createPa2Pdf = async ({ entries, plate = '', documentLabel = '', date = '', rows = [] }) => {
  if (!window.PDFLib?.PDFDocument) throw new Error('Biblioteca de PDF indisponível. Atualize a página e tente novamente.');
  if (!isValidPa2ImageCount(entries.length)) throw new Error('Adicione de 3 a 6 imagens para gerar o PA2.');

  const { PDFDocument, StandardFonts } = window.PDFLib;
  const document = await PDFDocument.create();
  document.setTitle('PA2 - MEGA Despachante');
  document.setCreator('MEGA Despachante');
  await appendImages(document, entries);

  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  let table = addTablePage({ document, font, boldFont, plate: plate.toUpperCase(), documentLabel });
  const fontSize = 8;
  const bottomLimit = PAGE_MARGIN + 34;
  const normalizedRows = PA2_ROWS.map((description, index) => {
    const parsedAmount = parseCurrencyValue(rows[index]?.amount);
    return {
      description,
      amount: Number.isFinite(parsedAmount) ? formatCurrencyValue(parsedAmount) : '',
      note: rows[index]?.note || '',
      parsedAmount,
    };
  });

  for (const row of normalizedRows) {
    const cells = [row.description.toUpperCase(), row.amount, row.note];
    const height = measureRowHeight(cells, table.widths, font, fontSize);
    if (table.y - height < bottomLimit) {
      table = addTablePage({ document, font, boldFont, plate: plate.toUpperCase(), documentLabel, continuation: true });
    }
    table.y = drawGridRow({ ...table, cells, x: PAGE_MARGIN, height, font, boldFont, size: fontSize, fill: table.colors.white });
  }

  const parsedValues = normalizedRows.map((row) => row.parsedAmount).filter(Number.isFinite);
  const total = parsedValues.length ? formatCurrencyValue(parsedValues.reduce((sum, value) => sum + value, 0)) : '';
  const formattedDate = date ? date.split('-').reverse().join('/') : '';
  const totalCells = ['TOTAL', total, formattedDate];
  const totalHeight = 31;
  if (table.y - totalHeight < PAGE_MARGIN) {
    table = addTablePage({ document, font, boldFont, plate: plate.toUpperCase(), documentLabel, continuation: true });
  }
  table.y = drawGridRow({ ...table, cells: totalCells, x: PAGE_MARGIN, height: totalHeight, font, boldFont, bold: true, size: 11, fill: table.colors.header });

  return document.save({ useObjectStreams: true });
};

const initPa2 = () => {
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
  if (!form || !input || !dropzone || !list || !tableBody || !generateButton) return;

  let entries = [];

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
    const noteCell = document.createElement('td');
    const note = document.createElement('input');
    note.name = `note-${index}`;
    note.maxLength = 180;
    note.placeholder = 'Observação';
    note.setAttribute('aria-label', `Observação de ${description}`);
    amountCell.append(amount);
    noteCell.append(note);
    row.append(descriptionCell, amountCell, noteCell);
    tableBody.append(row);
  });

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

  const addFiles = async (fileList) => {
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isValidPa2ImageCount(entries.length)) {
      setMessage('Adicione de 3 a 6 imagens antes de gerar o PA2.', 'error');
      return;
    }
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
        documentLabel: form.elements.document.value.trim(),
        date: form.elements.date.value,
        rows,
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
  });

  window.addEventListener('beforeunload', () => entries.forEach(releaseEntry));
  updateState();
};

if (typeof document !== 'undefined') initPa2();
