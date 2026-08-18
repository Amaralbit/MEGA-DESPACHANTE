// Modo editor: abre a procuração já gerada dentro de um modal e permite
// arrastar verticalmente a assinatura do outorgante antes de confirmar o
// download da versão editada. Reaproveita o modal (window.MegaModal) do
// form-experience.js e o pipeline de geração (window.downloadProtectedPdf)
// do script.js, então precisa carregar depois dos dois.
window.MegaSignatureEditor = (() => {
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let editorOpen = false;

  const openEditor = (config) => {
    if (editorOpen) return;
    if (!window.MegaModal) {
      window.alert('Não foi possível abrir o modo editor agora. Atualize a página e tente novamente.');
      return;
    }
    editorOpen = true;

    const { html, documentType, fileName, mode } = config;
    const modal = window.MegaModal.create('premium-editor-modal', 'signature-editor-title');
    const panel = modal.querySelector('.premium-modal-panel');
    panel.innerHTML = `
      <div class="premium-modal-header">
        <span class="premium-modal-icon" aria-hidden="true">✎</span>
        <div>
          <span class="premium-kicker">MODO EDITOR</span>
          <h2 id="signature-editor-title">Ajuste a assinatura</h2>
          <p>Arraste o nome do outorgante para cima ou para baixo até ficar onde você quiser. Depois, confirme para baixar a versão editada.</p>
        </div>
        <button type="button" class="premium-modal-close" aria-label="Fechar modo editor">×</button>
      </div>
      <div class="signature-editor-stage">
        <div class="signature-editor-scale"><iframe class="signature-editor-frame" title="Pré-visualização editável da procuração"></iframe></div>
      </div>
      <p class="signature-editor-status" data-editor-status>Carregando pré-visualização...</p>
      <div class="premium-modal-actions">
        <button type="button" class="premium-nav-button" data-editor-cancel>Cancelar</button>
        <button type="button" class="button button-primary" data-editor-confirm disabled>Confirmar e baixar versão editada</button>
      </div>
    `;

    const stage = panel.querySelector('.signature-editor-stage');
    const scaleWrapper = panel.querySelector('.signature-editor-scale');
    const frame = panel.querySelector('.signature-editor-frame');
    const status = panel.querySelector('[data-editor-status]');
    const confirmButton = panel.querySelector('[data-editor-confirm]');

    let offset = 0;
    let markEl = null;
    let injectedStyle = null;

    const relayout = () => {
      const available = stage.clientWidth - 4;
      const scale = clamp(available / PAGE_WIDTH, 0.28, 1);
      scaleWrapper.style.width = `${PAGE_WIDTH * scale}px`;
      scaleWrapper.style.height = `${PAGE_HEIGHT * scale}px`;
      frame.style.transform = `scale(${scale})`;
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') finish();
    };

    function finish() {
      editorOpen = false;
      window.removeEventListener('resize', relayout);
      document.removeEventListener('keydown', onKeydown);
      window.MegaModal.close(modal);
      window.setTimeout(() => modal.remove(), 400);
    }

    panel.querySelectorAll('.premium-modal-close, [data-editor-cancel]').forEach((button) => {
      button.addEventListener('click', finish);
    });
    modal.querySelector('[data-modal-close]').addEventListener('click', finish);
    document.addEventListener('keydown', onKeydown);

    frame.addEventListener('load', () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const mark = doc.querySelector('[data-drag-signature]');
      const bounds = doc.querySelector('.document');
      if (!mark || !bounds) {
        status.textContent = 'Não foi possível localizar a assinatura neste documento.';
        return;
      }

      markEl = mark;
      mark.style.position = 'relative';
      mark.style.cursor = 'grab';
      mark.style.touchAction = 'none';
      mark.style.userSelect = 'none';

      injectedStyle = doc.createElement('style');
      injectedStyle.textContent = '[data-drag-signature]{outline:2px dashed rgba(196,35,16,.55);outline-offset:6px;border-radius:4px;}';
      doc.head.appendChild(injectedStyle);

      let dragging = false;
      let startClientY = 0;
      let startOffset = 0;
      let minOffset = 0;
      let maxOffset = 0;

      const onPointerMove = (event) => {
        if (!dragging) return;
        const delta = event.clientY - startClientY;
        offset = clamp(startOffset + delta, minOffset, maxOffset);
        mark.style.top = `${offset}px`;
      };
      const stopDragging = () => {
        dragging = false;
        mark.style.cursor = 'grab';
        doc.removeEventListener('pointermove', onPointerMove);
        doc.removeEventListener('pointerup', stopDragging);
        doc.removeEventListener('pointercancel', stopDragging);
      };
      mark.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        dragging = true;
        startClientY = event.clientY;
        startOffset = offset;
        const markRect = mark.getBoundingClientRect();
        const boundsRect = bounds.getBoundingClientRect();
        const naturalTop = markRect.top - offset;
        minOffset = boundsRect.top - naturalTop;
        maxOffset = Math.max(minOffset, boundsRect.bottom - naturalTop - markRect.height);
        mark.style.cursor = 'grabbing';
        doc.addEventListener('pointermove', onPointerMove);
        doc.addEventListener('pointerup', stopDragging);
        doc.addEventListener('pointercancel', stopDragging);
      });

      status.textContent = 'Arraste o nome do outorgante para reposicionar a assinatura.';
      confirmButton.disabled = false;
      relayout();
    });

    frame.srcdoc = html;

    confirmButton.addEventListener('click', () => {
      const doc = frame.contentDocument;
      if (!doc || !markEl) return;
      injectedStyle?.remove();
      markEl.style.cursor = '';
      markEl.style.touchAction = '';
      markEl.style.userSelect = '';

      const editedHtml = `<!doctype html>\n${doc.documentElement.outerHTML}`;
      const editedFileName = `${fileName.replace(/\.pdf$/i, '')}-editado.pdf`;

      if (mode === 'popup') {
        const editedWindow = window.open('', '_blank', 'width=920,height=760');
        if (!editedWindow) {
          window.alert('Não foi possível abrir a versão editada. Libere pop-ups para continuar.');
          return;
        }
        editedWindow.document.write(editedHtml);
        editedWindow.document.close();
      } else {
        window.downloadProtectedPdf?.({ html: editedHtml, documentType, fileName: editedFileName });
      }
      finish();
    });

    window.addEventListener('resize', relayout);
    window.MegaModal.open(modal, panel.querySelector('[data-editor-cancel]'));
  };

  return {
    // button: elemento <button> que abre o editor. resolveConfig é chamada a
    // cada clique (não uma vez só), então o HTML sempre reflete os dados mais
    // recentes do formulário — o usuário não precisa gerar/baixar a versão
    // original antes de poder ajustar a assinatura. Deve devolver
    // { html, documentType, fileName, mode } — mode 'protected' baixa sozinho
    // via API, 'popup' abre janela para impressão manual (procuração
    // particular) — ou um valor falso para cancelar a abertura (ex.:
    // formulário inválido; quem resolve já deve ter avisado o usuário/focado
    // o campo problemático antes de retornar).
    attach(button, resolveConfig) {
      if (!button) return;
      button.disabled = false;
      button.onclick = () => {
        const config = typeof resolveConfig === 'function' ? resolveConfig() : resolveConfig;
        if (!config) return;
        openEditor(config);
      };
    },
  };
})();
