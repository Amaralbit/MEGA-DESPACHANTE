const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const PAGE_MARGIN = 28.35;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png']);
const QUALITY_SETTINGS = Object.freeze({
  high: { maxLongEdge: 3508, jpegQuality: 0.92 },
  balanced: { maxLongEdge: 2200, jpegQuality: 0.82 },
});

export const formatImageBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1).replace('.', ',')} MB`;
};

export const normalizeImagePdfName = (value) => {
  const withoutExtension = String(value || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 76);
  return `${withoutExtension || 'documentos-detran'}.pdf`;
};

export const fitImageOnPage = (imageWidth, imageHeight, pageWidth, pageHeight, margin = PAGE_MARGIN) => {
  const availableWidth = Math.max(1, pageWidth - (margin * 2));
  const availableHeight = Math.max(1, pageHeight - (margin * 2));
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
};

export const createImagesPdf = async (entries, PDFDocument) => {
  if (!PDFDocument) throw new Error('Biblioteca de PDF indisponível.');
  if (!Array.isArray(entries) || entries.length < 1) {
    throw new Error('Selecione pelo menos uma imagem.');
  }

  const document = await PDFDocument.create();
  for (const entry of entries) {
    const isPng = entry.mimeType === 'image/png';
    const image = isPng
      ? await document.embedPng(entry.bytes)
      : await document.embedJpg(entry.bytes);
    const landscape = entry.width > entry.height;
    const pageWidth = landscape ? A4.height : A4.width;
    const pageHeight = landscape ? A4.width : A4.height;
    const page = document.addPage();
    page.setSize(pageWidth, pageHeight);
    const placement = fitImageOnPage(entry.width, entry.height, pageWidth, pageHeight);
    page.drawImage(image, placement);
  }

  return document.save({ useObjectStreams: true });
};

const loadBrowserImage = async (file, sourceUrl) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = sourceUrl;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(`${file.name}: imagem sem dimensões válidas.`);
  }
  return image;
};

const canvasToJpegBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Não foi possível preparar uma das imagens.'));
      return;
    }
    resolve(blob);
  }, 'image/jpeg', quality);
});

const canvasToJpegBytes = async (canvas, quality) => {
  const blob = await canvasToJpegBlob(canvas, quality);
  return new Uint8Array(await blob.arrayBuffer());
};

const createImageThumbnailUrl = async (image) => {
  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Não foi possível criar a miniatura.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return URL.createObjectURL(await canvasToJpegBlob(canvas, 0.78));
};

export const prepareImageForPdf = async (entry, qualityName = 'high') => {
  const quality = QUALITY_SETTINGS[qualityName] || QUALITY_SETTINGS.high;
  const sourceUrl = URL.createObjectURL(entry.file);
  let image;
  try {
    image = await loadBrowserImage(entry.file, sourceUrl);
    const rotation = ((entry.rotation % 360) + 360) % 360;
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const scale = Math.min(1, quality.maxLongEdge / Math.max(sourceWidth, sourceHeight));
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const swapsSides = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swapsSides ? drawHeight : drawWidth;
    canvas.height = swapsSides ? drawWidth : drawHeight;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    if (rotation === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
    } else if (rotation === 180) {
      context.translate(canvas.width, canvas.height);
      context.rotate(Math.PI);
    } else if (rotation === 270) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
    }
    context.drawImage(image, 0, 0, drawWidth, drawHeight);

    return {
      bytes: await canvasToJpegBytes(canvas, quality.jpegQuality),
      mimeType: 'image/jpeg',
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    if (image) image.src = '';
    URL.revokeObjectURL(sourceUrl);
  }
};

const initImagePdfConverter = () => {
  const input = document.getElementById('image-pdf-input');
  const dropzone = document.getElementById('image-pdf-dropzone');
  const selection = document.getElementById('image-pdf-selection');
  const list = document.getElementById('image-pdf-list');
  const message = document.getElementById('image-pdf-message');
  const count = document.getElementById('image-pdf-count');
  const pages = document.getElementById('image-pdf-pages');
  const size = document.getElementById('image-pdf-size');
  const clearButton = document.getElementById('image-pdf-clear');
  const quality = document.getElementById('image-pdf-quality');
  const outputName = document.getElementById('image-pdf-output-name');
  const convertButton = document.getElementById('image-pdf-convert');
  const actionNote = document.getElementById('image-pdf-action-note');
  const success = document.getElementById('image-pdf-success');
  const successDetails = document.getElementById('image-pdf-success-details');
  const downloadAgain = document.getElementById('image-pdf-download-again');

  if (!input || !dropzone || !window.PDFLib?.PDFDocument) {
    if (message) {
      message.className = 'pdf-message pdf-message-error';
      message.textContent = 'Não foi possível carregar a ferramenta. Atualize a página e tente novamente.';
    }
    return;
  }

  let entries = [];
  let draggedId = '';
  let downloadUrl = '';

  const setMessage = (text = '', type = '') => {
    message.textContent = text;
    message.className = `pdf-message${type ? ` pdf-message-${type}` : ''}`;
  };

  const revokeDownload = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = '';
    success.hidden = true;
    downloadAgain.removeAttribute('href');
  };

  const releaseEntry = (entry) => {
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  };

  const updateState = () => {
    const files = entries.length;
    const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    selection.hidden = files === 0;
    count.textContent = `${files} ${files === 1 ? 'imagem' : 'imagens'}`;
    pages.textContent = `${files} ${files === 1 ? 'página' : 'páginas'}`;
    size.textContent = formatImageBytes(totalBytes);
    convertButton.disabled = files < 1;
    actionNote.textContent = files
      ? `${files} ${files === 1 ? 'página será criada' : 'páginas serão criadas'}, sem cortar as imagens.`
      : 'Adicione pelo menos uma imagem para continuar.';
  };

  const moveEntry = (id, direction) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    revokeDownload();
    renderList();
  };

  const rotateEntry = (id, direction) => {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) return;
    entry.rotation = (entry.rotation + direction + 360) % 360;
    revokeDownload();
    renderList();
  };

  const makeControl = (label, text, className, handler, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
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
      item.className = 'pdf-file-item image-pdf-item';
      item.dataset.id = entry.id;
      item.draggable = true;

      const order = document.createElement('span');
      order.className = 'pdf-file-order';
      order.textContent = String(index + 1).padStart(2, '0');

      const preview = document.createElement('span');
      preview.className = 'image-pdf-preview';
      const image = document.createElement('img');
      image.src = entry.previewUrl;
      image.alt = '';
      image.style.transform = `rotate(${entry.rotation}deg)`;
      preview.append(image);

      const copy = document.createElement('div');
      copy.className = 'pdf-file-copy';
      const name = document.createElement('strong');
      name.textContent = entry.file.name;
      const metadata = document.createElement('span');
      const displayedWidth = entry.rotation % 180 === 0 ? entry.width : entry.height;
      const displayedHeight = entry.rotation % 180 === 0 ? entry.height : entry.width;
      metadata.textContent = `${displayedWidth} × ${displayedHeight} px · ${formatImageBytes(entry.file.size)}`;
      copy.append(name, metadata);

      const controls = document.createElement('div');
      controls.className = 'pdf-file-controls image-pdf-controls';
      controls.append(
        makeControl(`Mover ${entry.file.name} para cima`, '↑', 'pdf-order-button', () => moveEntry(entry.id, -1), index === 0),
        makeControl(`Mover ${entry.file.name} para baixo`, '↓', 'pdf-order-button', () => moveEntry(entry.id, 1), index === entries.length - 1),
        makeControl(`Girar ${entry.file.name} para a esquerda`, '↶', 'image-rotate-button', () => rotateEntry(entry.id, -90)),
        makeControl(`Girar ${entry.file.name} para a direita`, '↷', 'image-rotate-button', () => rotateEntry(entry.id, 90)),
        makeControl(`Remover ${entry.file.name}`, '×', 'pdf-remove-button', () => {
          releaseEntry(entry);
          entries = entries.filter((candidate) => candidate.id !== entry.id);
          revokeDownload();
          setMessage(`${entry.file.name} foi removida.`, 'info');
          renderList();
        }),
      );

      item.append(order, preview, copy, controls);
      item.addEventListener('dragstart', () => {
        draggedId = entry.id;
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', () => {
        draggedId = '';
        item.classList.remove('is-dragging');
        list.querySelectorAll('.is-drag-target').forEach((target) => target.classList.remove('is-drag-target'));
      });
      item.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (draggedId && draggedId !== entry.id) item.classList.add('is-drag-target');
      });
      item.addEventListener('dragleave', () => item.classList.remove('is-drag-target'));
      item.addEventListener('drop', (event) => {
        event.preventDefault();
        item.classList.remove('is-drag-target');
        const sourceIndex = entries.findIndex((candidate) => candidate.id === draggedId);
        const targetIndex = entries.findIndex((candidate) => candidate.id === entry.id);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
        const [moved] = entries.splice(sourceIndex, 1);
        entries.splice(targetIndex, 0, moved);
        revokeDownload();
        renderList();
      });
      list.append(item);
    });
    updateState();
  };

  const addFiles = async (fileList) => {
    const candidates = [...fileList];
    if (!candidates.length) return;
    setMessage('Lendo e conferindo as imagens...', 'loading');
    dropzone.setAttribute('aria-busy', 'true');

    const messages = [];
    let added = 0;
    for (const file of candidates) {
      const extensionAccepted = /\.(jpe?g|png)$/i.test(file.name);
      if (!ACCEPTED_TYPES.has(file.type) && !extensionAccepted) {
        messages.push(`${file.name}: use somente imagens JPG ou PNG.`);
        continue;
      }
      if (entries.length >= MAX_FILES) {
        messages.push(`Limite de ${MAX_FILES} imagens atingido.`);
        break;
      }
      const duplicate = entries.some((entry) => (
        entry.file.name === file.name
        && entry.file.size === file.size
        && entry.file.lastModified === file.lastModified
      ));
      if (duplicate) {
        messages.push(`${file.name}: esta imagem já foi adicionada.`);
        continue;
      }
      const currentBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
      if (currentBytes + file.size > MAX_TOTAL_BYTES) {
        messages.push(`${file.name}: o conjunto ultrapassaria o limite de 50 MB.`);
        continue;
      }

      const sourceUrl = URL.createObjectURL(file);
      try {
        const image = await loadBrowserImage(file, sourceUrl);
        const previewUrl = await createImageThumbnailUrl(image);
        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          width: image.naturalWidth,
          height: image.naturalHeight,
          previewUrl,
          rotation: 0,
        });
        image.src = '';
        added += 1;
      } catch {
        messages.push(`${file.name}: não foi possível ler esta imagem.`);
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    }

    input.value = '';
    dropzone.removeAttribute('aria-busy');
    revokeDownload();
    renderList();
    if (messages.length) {
      setMessage(messages.join(' '), 'error');
    } else {
      setMessage(`${added} ${added === 1 ? 'imagem adicionada' : 'imagens adicionadas'} com sucesso.`, 'success');
    }
  };

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    input.click();
  });
  input.addEventListener('change', () => void addFiles(input.files));

  ['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', (event) => void addFiles(event.dataTransfer.files));

  clearButton.addEventListener('click', () => {
    entries.forEach(releaseEntry);
    entries = [];
    input.value = '';
    revokeDownload();
    setMessage('A seleção foi limpa.', 'info');
    renderList();
  });
  quality.addEventListener('change', revokeDownload);

  convertButton.addEventListener('click', async () => {
    if (!entries.length) return;
    convertButton.disabled = true;
    convertButton.classList.add('is-loading');
    convertButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Preparando imagens...';
    setMessage('Montando o PDF no seu aparelho. Não feche esta página.', 'loading');

    try {
      const preparedEntries = [];
      for (let index = 0; index < entries.length; index += 1) {
        setMessage(`Preparando imagem ${index + 1} de ${entries.length}...`, 'loading');
        preparedEntries.push(await prepareImageForPdf(entries[index], quality.value));
      }
      const pdfBytes = await createImagesPdf(preparedEntries, window.PDFLib.PDFDocument);
      const fileName = normalizeImagePdfName(outputName.value);
      outputName.value = fileName.replace(/\.pdf$/i, '');
      revokeDownload();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      downloadUrl = URL.createObjectURL(blob);
      downloadAgain.href = downloadUrl;
      downloadAgain.download = fileName;

      const download = document.createElement('a');
      download.href = downloadUrl;
      download.download = fileName;
      document.body.append(download);
      download.click();
      download.remove();

      successDetails.textContent = `${fileName} · ${entries.length} ${entries.length === 1 ? 'página' : 'páginas'} · ${formatImageBytes(blob.size)}`;
      success.hidden = false;
      setMessage('PDF criado e baixado. Suas imagens continuaram somente neste aparelho.', 'success');
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setMessage(error?.message || 'Não foi possível converter estas imagens. Tente novamente.', 'error');
    } finally {
      convertButton.classList.remove('is-loading');
      convertButton.innerHTML = 'Converter e baixar PDF <span>→</span>';
      updateState();
    }
  });

  window.addEventListener('beforeunload', () => {
    revokeDownload();
    entries.forEach(releaseEntry);
  });
  updateState();
};

if (typeof document !== 'undefined') {
  initImagePdfConverter();
}
