import * as pdfjsLib from './assets/vendor/pdfjs/pdf.min.mjs';
import {
  calculateCompressionSavings,
  formatCompressedBytes,
  getCompressionAttempts,
  getRenderScale,
  hasPdfDigitalSignature,
  normalizeCompressedName,
} from './compress-pdf-utils.js';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 80;
const PDF_MIME_TYPE = 'application/pdf';
const pdfJsAssetUrl = (path) => new URL(`./assets/vendor/pdfjs/${path}`, import.meta.url).href;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsAssetUrl('pdf.worker.min.mjs');

const pdfLoadingTasks = new WeakMap();

const destroyPdfDocument = async (documentProxy) => {
  if (!documentProxy) return;
  const loadingTask = pdfLoadingTasks.get(documentProxy);
  pdfLoadingTasks.delete(documentProxy);
  await loadingTask?.destroy();
};

const openPdfDocument = async (bytes) => {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: pdfJsAssetUrl('cmaps/'),
    cMapPacked: true,
    iccUrl: pdfJsAssetUrl('iccs/'),
    standardFontDataUrl: pdfJsAssetUrl('standard_fonts/'),
    wasmUrl: pdfJsAssetUrl('wasm/'),
    isEvalSupported: false,
  });

  let rejectPassword;
  const passwordRequest = new Promise((_, reject) => {
    rejectPassword = reject;
  });
  loadingTask.onPassword = () => {
    rejectPassword(new Error('PDF protegido por senha. Desbloqueie o arquivo antes de comprimir.'));
    void loadingTask.destroy();
  };

  try {
    const documentProxy = await Promise.race([loadingTask.promise, passwordRequest]);
    pdfLoadingTasks.set(documentProxy, loadingTask);
    return documentProxy;
  } catch (error) {
    void loadingTask.destroy();
    if (/password|senha/i.test(error?.message || '')) throw error;
    throw new Error('Não foi possível ler este PDF. Confira se o arquivo não está corrompido.');
  }
};

const canvasToJpegBytes = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(async (blob) => {
    if (!blob) {
      reject(new Error('Não foi possível otimizar uma das páginas.'));
      return;
    }
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, 'image/jpeg', quality);
});

const renderCompressedPdf = async ({ file, preset, onProgress }) => {
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceDocument = await openPdfDocument(sourceBytes);
  const outputDocument = await window.PDFLib.PDFDocument.create();

  try {
    for (let pageNumber = 1; pageNumber <= sourceDocument.numPages; pageNumber += 1) {
      onProgress(pageNumber - 1, sourceDocument.numPages, `Otimizando página ${pageNumber} de ${sourceDocument.numPages}`);
      const sourcePage = await sourceDocument.getPage(pageNumber);
      const baseViewport = sourcePage.getViewport({ scale: 1 });
      const scale = getRenderScale(baseViewport.width, baseViewport.height, preset);
      const renderViewport = sourcePage.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(renderViewport.width));
      canvas.height = Math.max(1, Math.round(renderViewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Seu navegador não conseguiu preparar uma das páginas.');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await sourcePage.render({
        canvas,
        canvasContext: context,
        viewport: renderViewport,
        background: 'rgb(255,255,255)',
      }).promise;

      const jpegBytes = await canvasToJpegBytes(canvas, preset.jpegQuality);
      const image = await outputDocument.embedJpg(jpegBytes);
      const outputPage = outputDocument.addPage();
      outputPage.setSize(baseViewport.width, baseViewport.height);
      outputPage.drawImage(image, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });

      sourcePage.cleanup();
      canvas.width = 1;
      canvas.height = 1;
      onProgress(pageNumber, sourceDocument.numPages, `Página ${pageNumber} de ${sourceDocument.numPages} concluída`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    onProgress(sourceDocument.numPages, sourceDocument.numPages, 'Finalizando o PDF...');
    return outputDocument.save({ useObjectStreams: true });
  } finally {
    await destroyPdfDocument(sourceDocument);
  }
};

const initPdfCompressor = () => {
  const input = document.getElementById('pdf-compress-input');
  const dropzone = document.getElementById('pdf-compress-dropzone');
  const message = document.getElementById('pdf-compress-message');
  const selection = document.getElementById('pdf-compress-selection');
  const fileName = document.getElementById('pdf-compress-file-name');
  const pageCount = document.getElementById('pdf-compress-page-count');
  const originalSize = document.getElementById('pdf-compress-original-size');
  const removeButton = document.getElementById('pdf-compress-remove');
  const qualityInputs = [...document.querySelectorAll('input[name="pdf-compress-quality"]')];
  const signatureWarning = document.getElementById('pdf-compress-signature-warning');
  const signatureConfirmation = document.getElementById('pdf-compress-signature-confirmation');
  const outputName = document.getElementById('pdf-compress-output-name');
  const progress = document.getElementById('pdf-compress-progress');
  const progressLabel = document.getElementById('pdf-compress-progress-label');
  const progressPercent = document.getElementById('pdf-compress-progress-percent');
  const progressTrack = progress?.querySelector('[role="progressbar"]');
  const progressBar = progressTrack?.querySelector('span');
  const compressButton = document.getElementById('pdf-compress-button');
  const actionNote = document.getElementById('pdf-compress-action-note');
  const success = document.getElementById('pdf-compress-success');
  const successName = document.getElementById('pdf-compress-success-name');
  const resultOriginal = document.getElementById('pdf-compress-result-original');
  const resultFinal = document.getElementById('pdf-compress-result-final');
  const resultSaving = document.getElementById('pdf-compress-result-saving');
  const downloadAgain = document.getElementById('pdf-compress-download-again');

  if (!input || !dropzone || !window.PDFLib?.PDFDocument || !pdfjsLib?.getDocument) {
    if (message) {
      message.className = 'pdf-message pdf-message-error';
      message.textContent = 'Não foi possível carregar a ferramenta. Atualize a página e tente novamente.';
    }
    return;
  }

  let selectedFile = null;
  let selectedPages = 0;
  let selectedHasSignature = false;
  let downloadUrl = '';
  let processing = false;

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

  const selectedQuality = () => qualityInputs.find((option) => option.checked)?.value || 'balanced';

  const updateButtonState = () => {
    const signatureAccepted = !selectedHasSignature || signatureConfirmation.checked;
    compressButton.disabled = processing || !selectedFile || !signatureAccepted;
    if (!selectedFile) {
      actionNote.textContent = 'Adicione um PDF para continuar.';
    } else if (!signatureAccepted) {
      actionNote.textContent = 'Confirme o aviso sobre assinatura digital para continuar.';
    } else {
      actionNote.textContent = `${selectedPages} ${selectedPages === 1 ? 'página será otimizada' : 'páginas serão otimizadas'} somente neste aparelho.`;
    }
  };

  const updateProgress = (completed, total, label) => {
    const percent = total ? Math.round((completed / total) * 100) : 0;
    progressLabel.textContent = label;
    progressPercent.textContent = `${percent}%`;
    progressTrack.setAttribute('aria-valuenow', String(percent));
    progressBar.style.width = `${percent}%`;
  };

  const clearSelection = () => {
    selectedFile = null;
    selectedPages = 0;
    selectedHasSignature = false;
    input.value = '';
    selection.hidden = true;
    signatureWarning.hidden = true;
    signatureConfirmation.checked = false;
    progress.hidden = true;
    revokeDownload();
    updateButtonState();
  };

  const selectFile = async (file) => {
    if (!file) return;
    const isPdf = file.type === PDF_MIME_TYPE || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setMessage('Selecione somente um arquivo PDF.', 'error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage('Este arquivo ultrapassa o limite de 40 MB.', 'error');
      return;
    }

    setMessage('Lendo e conferindo o PDF...', 'loading');
    dropzone.setAttribute('aria-busy', 'true');
    input.disabled = true;
    revokeDownload();

    let documentProxy;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      selectedHasSignature = hasPdfDigitalSignature(bytes);
      documentProxy = await openPdfDocument(bytes.slice());
      if (documentProxy.numPages > MAX_PAGES) {
        throw new Error(`Este PDF possui mais de ${MAX_PAGES} páginas.`);
      }

      selectedFile = file;
      selectedPages = documentProxy.numPages;
      fileName.textContent = file.name;
      pageCount.textContent = `${selectedPages} ${selectedPages === 1 ? 'página' : 'páginas'}`;
      originalSize.textContent = formatCompressedBytes(file.size);
      outputName.value = `${file.name.replace(/\.pdf$/i, '')}-comprimido`.slice(0, 76);
      signatureWarning.hidden = !selectedHasSignature;
      signatureConfirmation.checked = false;
      selection.hidden = false;
      progress.hidden = true;
      setMessage('PDF pronto para compressão.', 'success');
      updateButtonState();
    } catch (error) {
      clearSelection();
      setMessage(error?.message || 'Não foi possível ler este PDF.', 'error');
    } finally {
      await destroyPdfDocument(documentProxy);
      input.disabled = false;
      input.value = '';
      dropzone.removeAttribute('aria-busy');
    }
  };

  dropzone.addEventListener('click', () => {
    if (!processing) input.click();
  });
  dropzone.addEventListener('keydown', (event) => {
    if (processing || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    input.click();
  });
  input.addEventListener('change', () => void selectFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      if (!processing) dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', (event) => {
    if (!processing) void selectFile(event.dataTransfer.files[0]);
  });

  removeButton.addEventListener('click', () => {
    clearSelection();
    setMessage('O arquivo foi removido.', 'info');
  });
  signatureConfirmation.addEventListener('change', updateButtonState);
  qualityInputs.forEach((option) => option.addEventListener('change', () => {
    revokeDownload();
    setMessage('Qualidade atualizada. O PDF será processado com esta configuração.', 'info');
  }));

  compressButton.addEventListener('click', async () => {
    if (!selectedFile || processing) return;
    processing = true;
    revokeDownload();
    progress.hidden = false;
    updateProgress(0, selectedPages, 'Preparando o documento...');
    compressButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Comprimindo PDF...';
    dropzone.setAttribute('aria-busy', 'true');
    setMessage('A compressão pode levar alguns instantes. Não feche esta página.', 'loading');
    updateButtonState();

    try {
      const quality = selectedQuality();
      const attempts = getCompressionAttempts(quality);
      let compressedBytes;
      let lastCompressionError;

      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
        if (attemptIndex > 0) {
          compressedBytes = undefined;
          await new Promise((resolve) => window.setTimeout(resolve, 0));
          progress.hidden = false;
          updateProgress(0, selectedPages, 'Ajustando a qualidade...');
          setMessage('A tentativa anterior não reduziu o arquivo. Ajustando a qualidade automaticamente...', 'loading');
        }

        try {
          compressedBytes = await renderCompressedPdf({
            file: selectedFile,
            preset: attempts[attemptIndex],
            onProgress: (completed, total, label) => {
              const adjustedLabel = attemptIndex > 0 ? `Ajuste ${attemptIndex} · ${label}` : label;
              updateProgress(completed, total, adjustedLabel);
            },
          });
          lastCompressionError = undefined;
        } catch (error) {
          lastCompressionError = error;
          compressedBytes = undefined;
          if (attemptIndex === attempts.length - 1) throw error;
          continue;
        }

        if (compressedBytes.length < selectedFile.size) break;
      }

      if (!compressedBytes && lastCompressionError) throw lastCompressionError;

      if (compressedBytes.length >= selectedFile.size) {
        progress.hidden = true;
        setMessage('Este PDF já está muito otimizado e nem o ajuste automático conseguiu deixá-lo menor. O arquivo original foi mantido. Tente a opção indicada no fim da página.', 'info');
        return;
      }

      const finalName = normalizeCompressedName(outputName.value);
      outputName.value = finalName.replace(/\.pdf$/i, '');
      const blob = new Blob([compressedBytes], { type: PDF_MIME_TYPE });
      downloadUrl = URL.createObjectURL(blob);
      downloadAgain.href = downloadUrl;
      downloadAgain.download = finalName;

      const download = document.createElement('a');
      download.href = downloadUrl;
      download.download = finalName;
      document.body.append(download);
      download.click();
      download.remove();

      const savings = calculateCompressionSavings(selectedFile.size, blob.size);
      successName.textContent = finalName;
      resultOriginal.textContent = formatCompressedBytes(selectedFile.size);
      resultFinal.textContent = formatCompressedBytes(blob.size);
      resultSaving.textContent = `${savings}% menor`;
      success.hidden = false;
      setMessage('PDF comprimido e baixado. O documento continuou somente neste aparelho.', 'success');
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      progress.hidden = true;
      setMessage(error?.message || 'Não foi possível comprimir este PDF. Tente novamente.', 'error');
    } finally {
      processing = false;
      dropzone.removeAttribute('aria-busy');
      compressButton.innerHTML = 'Comprimir e baixar PDF <span>→</span>';
      updateButtonState();
    }
  });

  window.addEventListener('beforeunload', revokeDownload);
  updateButtonState();
};

initPdfCompressor();
