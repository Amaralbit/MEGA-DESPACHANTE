const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const PDF_MIME_TYPE = 'application/pdf';

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1).replace('.', ',')} MB`;
};

const containsAsciiSequence = (bytes, sequence) => {
  const pattern = [...sequence].map((character) => character.charCodeAt(0));
  for (let offset = 0; offset <= bytes.length - pattern.length; offset += 1) {
    let matches = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (bytes[offset + index] !== pattern[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
};

export const hasDigitalSignature = (bytes) => {
  return containsAsciiSequence(bytes, '/ByteRange')
    || containsAsciiSequence(bytes, '/Type /Sig')
    || containsAsciiSequence(bytes, '/SubFilter /adbe.pkcs7');
};

export const normalizeOutputName = (value) => {
  const withoutExtension = String(value || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 76);
  return `${withoutExtension || 'documentos-detran'}.pdf`;
};

export const mergePdfEntries = async (entries, PDFDocument) => {
  if (!PDFDocument) throw new Error('Biblioteca de PDF indisponível.');
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error('Selecione pelo menos dois arquivos PDF.');
  }

  const mergedDocument = await PDFDocument.create();
  for (const entry of entries) {
    const sourceDocument = await PDFDocument.load(entry.bytes);
    const pages = await mergedDocument.copyPages(sourceDocument, sourceDocument.getPageIndices());
    pages.forEach((page) => mergedDocument.addPage(page));
  }

  return mergedDocument.save({ useObjectStreams: true });
};

const initPdfMerger = () => {
  const input = document.getElementById('pdf-file-input');
  const dropzone = document.getElementById('pdf-dropzone');
  const selection = document.getElementById('pdf-selection');
  const list = document.getElementById('pdf-file-list');
  const message = document.getElementById('pdf-message');
  const count = document.getElementById('pdf-file-count');
  const pageCount = document.getElementById('pdf-page-count');
  const totalSize = document.getElementById('pdf-total-size');
  const clearButton = document.getElementById('pdf-clear-button');
  const mergeButton = document.getElementById('pdf-merge-button');
  const actionNote = document.getElementById('pdf-action-note');
  const outputName = document.getElementById('pdf-output-name');
  const signatureWarning = document.getElementById('pdf-signature-warning');
  const signatureConfirmation = document.getElementById('pdf-signature-confirmation');
  const success = document.getElementById('pdf-success');
  const successDetails = document.getElementById('pdf-success-details');
  const downloadAgain = document.getElementById('pdf-download-again');

  if (!input || !dropzone || !window.PDFLib?.PDFDocument) {
    if (message) {
      message.className = 'pdf-message pdf-message-error';
      message.textContent = 'Não foi possível carregar a ferramenta de PDF. Atualize a página e tente novamente.';
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

  const updateState = () => {
    const files = entries.length;
    const pages = entries.reduce((sum, entry) => sum + entry.pages, 0);
    const bytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    const signed = entries.some((entry) => entry.hasDigitalSignature);
    const signatureAccepted = !signed || signatureConfirmation.checked;

    selection.hidden = files === 0;
    count.textContent = `${files} ${files === 1 ? 'arquivo' : 'arquivos'}`;
    pageCount.textContent = `${pages} ${pages === 1 ? 'página' : 'páginas'}`;
    totalSize.textContent = formatBytes(bytes);
    signatureWarning.hidden = !signed;
    if (!signed) signatureConfirmation.checked = false;

    mergeButton.disabled = files < 2 || !signatureAccepted;
    if (files < 2) {
      actionNote.textContent = 'Adicione pelo menos dois arquivos para continuar.';
    } else if (!signatureAccepted) {
      actionNote.textContent = 'Confirme o aviso sobre assinatura digital para continuar.';
    } else {
      actionNote.textContent = `${pages} páginas serão reunidas na ordem mostrada acima.`;
    }
  };

  const moveEntry = (id, direction) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    revokeDownload();
    renderList();
  };

  const renderList = () => {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'pdf-file-item';
      item.dataset.id = entry.id;
      item.draggable = true;

      const handle = document.createElement('span');
      handle.className = 'pdf-drag-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.textContent = '⠿';

      const order = document.createElement('span');
      order.className = 'pdf-file-order';
      order.textContent = String(index + 1).padStart(2, '0');

      const copy = document.createElement('div');
      copy.className = 'pdf-file-copy';
      const name = document.createElement('strong');
      name.textContent = entry.file.name;
      const metadata = document.createElement('span');
      metadata.textContent = `${entry.pages} ${entry.pages === 1 ? 'página' : 'páginas'} · ${formatBytes(entry.file.size)}`;
      copy.append(name, metadata);
      if (entry.hasDigitalSignature) {
        const badge = document.createElement('small');
        badge.className = 'pdf-signature-badge';
        badge.textContent = 'Possível assinatura digital';
        copy.append(badge);
      }

      const controls = document.createElement('div');
      controls.className = 'pdf-file-controls';
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'pdf-order-button';
      up.setAttribute('aria-label', `Mover ${entry.file.name} para cima`);
      up.textContent = '↑';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveEntry(entry.id, -1));

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'pdf-order-button';
      down.setAttribute('aria-label', `Mover ${entry.file.name} para baixo`);
      down.textContent = '↓';
      down.disabled = index === entries.length - 1;
      down.addEventListener('click', () => moveEntry(entry.id, 1));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pdf-remove-button';
      remove.setAttribute('aria-label', `Remover ${entry.file.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        entries = entries.filter((candidate) => candidate.id !== entry.id);
        revokeDownload();
        setMessage(`${entry.file.name} foi removido.`, 'info');
        renderList();
      });

      controls.append(up, down, remove);
      item.append(handle, order, copy, controls);

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
    setMessage('Lendo e conferindo os arquivos...', 'loading');
    dropzone.setAttribute('aria-busy', 'true');

    const messages = [];
    for (const file of candidates) {
      const isPdf = file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        messages.push(`${file.name}: selecione somente arquivos PDF.`);
        continue;
      }
      if (entries.length >= MAX_FILES) {
        messages.push(`Limite de ${MAX_FILES} arquivos atingido.`);
        break;
      }
      const duplicate = entries.some((entry) => (
        entry.file.name === file.name
        && entry.file.size === file.size
        && entry.file.lastModified === file.lastModified
      ));
      if (duplicate) {
        messages.push(`${file.name}: este arquivo já foi adicionado.`);
        continue;
      }
      const currentBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
      if (currentBytes + file.size > MAX_TOTAL_BYTES) {
        messages.push(`${file.name}: o conjunto ultrapassaria o limite de 50 MB.`);
        continue;
      }

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdfDocument = await window.PDFLib.PDFDocument.load(bytes);
        const pages = pdfDocument.getPageCount();
        if (!pages) throw new Error('PDF sem páginas.');
        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          bytes,
          pages,
          hasDigitalSignature: hasDigitalSignature(bytes),
        });
      } catch (error) {
        const protectedFile = error?.name === 'EncryptedPDFError' || /encrypt/i.test(error?.message || '');
        messages.push(protectedFile
          ? `${file.name}: PDF protegido por senha. Desbloqueie o arquivo antes de adicioná-lo.`
          : `${file.name}: não foi possível ler este PDF.`);
      }
    }

    input.value = '';
    dropzone.removeAttribute('aria-busy');
    revokeDownload();
    renderList();
    if (messages.length) {
      setMessage(messages.join(' '), 'error');
    } else {
      setMessage(`${candidates.length} ${candidates.length === 1 ? 'arquivo adicionado' : 'arquivos adicionados'} com sucesso.`, 'success');
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
    entries = [];
    input.value = '';
    signatureConfirmation.checked = false;
    revokeDownload();
    setMessage('A seleção foi limpa.', 'info');
    renderList();
  });
  signatureConfirmation.addEventListener('change', updateState);

  mergeButton.addEventListener('click', async () => {
    if (entries.length < 2) return;
    mergeButton.disabled = true;
    mergeButton.classList.add('is-loading');
    mergeButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Juntando documentos...';
    setMessage('Montando o PDF no seu aparelho. Não feche esta página.', 'loading');

    try {
      const mergedBytes = await mergePdfEntries(entries, window.PDFLib.PDFDocument);
      const fileName = normalizeOutputName(outputName.value);
      outputName.value = fileName.replace(/\.pdf$/i, '');
      revokeDownload();
      const blob = new Blob([mergedBytes], { type: PDF_MIME_TYPE });
      downloadUrl = URL.createObjectURL(blob);
      downloadAgain.href = downloadUrl;
      downloadAgain.download = fileName;

      const download = document.createElement('a');
      download.href = downloadUrl;
      download.download = fileName;
      document.body.append(download);
      download.click();
      download.remove();

      const pages = entries.reduce((sum, entry) => sum + entry.pages, 0);
      successDetails.textContent = `${fileName} · ${pages} páginas · ${formatBytes(blob.size)}`;
      success.hidden = false;
      setMessage('PDF unido e baixado. Seus arquivos continuaram somente neste aparelho.', 'success');
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setMessage(error?.message || 'Não foi possível juntar estes arquivos. Tente novamente.', 'error');
    } finally {
      mergeButton.classList.remove('is-loading');
      mergeButton.innerHTML = 'Juntar e baixar PDF <span>→</span>';
      updateState();
    }
  });

  window.addEventListener('beforeunload', revokeDownload);
  updateState();
};

if (typeof document !== 'undefined') {
  initPdfMerger();
}
