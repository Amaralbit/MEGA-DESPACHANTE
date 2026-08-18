(() => {
  const forms = [...document.querySelectorAll('form.procuracao-form')];
  if (!forms.length) return;

  const WHATSAPP_NUMBER = '556299712947';
  const DRAFT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onlyNumbers = (value) => String(value || '').replace(/\D/g, '');
  const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const isValidCpf = (value) => {
    const digits = onlyNumbers(value);
    if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;

    const calculateDigit = (length) => {
      let total = 0;
      for (let index = 0; index < length; index += 1) {
        total += Number(digits[index]) * (length + 1 - index);
      }
      const remainder = (total * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };

    return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
  };

  const isValidCnpj = (value) => {
    const digits = onlyNumbers(value);
    if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

    const calculateDigit = (length) => {
      const weights = length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const total = weights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0);
      const remainder = total % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
  };

  const fieldLabel = (control) => {
    const label = control.closest('label')
      || (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null);
    if (!label) return control.name || 'Campo';

    const clone = label.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, small, .premium-field-message').forEach((node) => node.remove());
    return cleanText(clone.textContent).replace(/\s*\*$/, '') || control.name || 'Campo';
  };

  const validationMessage = (control) => {
    if (control.disabled || control.readOnly || control.type === 'hidden') return '';
    const value = cleanText(control.value);

    if (control.required && control.type === 'checkbox' && !control.checked) {
      return 'Confirme esta informação para continuar.';
    }
    if (control.required && !value) return 'Preencha este campo para continuar.';
    if (!value) return '';

    const mask = control.dataset.mask;
    const name = control.name || '';

    if (mask === 'cpf' && !isValidCpf(value)) return 'Digite um CPF válido com 11 números.';
    if (mask === 'cpf-cnpj') {
      const digits = onlyNumbers(value);
      if (digits.length !== 11 && digits.length !== 14) return 'Digite um CPF ou CNPJ completo.';
      if (digits.length === 11 && !isValidCpf(value)) return 'Confira o CPF informado.';
      if (digits.length === 14 && !isValidCnpj(value)) return 'Confira o CNPJ informado.';
    }
    if (mask === 'cep' && onlyNumbers(value).length !== 8) return 'Digite um CEP completo com 8 números.';
    if (mask === 'telefone' && ![10, 11].includes(onlyNumbers(value).length)) return 'Digite o telefone com DDD.';
    if (mask === 'placa' && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(value.replace(/[^A-Z0-9]/gi, ''))) {
      return 'Use o formato ABC1234 ou ABC1D23.';
    }
    if (/chassi/i.test(name) && !/^[A-HJ-NPR-Z0-9]{9,17}$/i.test(value)) {
      // Veículos antigos (antes do padrão VIN de 17 caracteres) podem ter chassi com só 9 dígitos.
      return 'O chassi deve ter entre 9 e 17 caracteres válidos.';
    }
    if (/anoFabricacao|anoModelo/i.test(name)) {
      const year = Number(value);
      const maximumYear = new Date().getFullYear() + 1;
      if (!/^\d{4}$/.test(value) || year < 1900 || year > maximumYear) {
        return `Informe um ano entre 1900 e ${maximumYear}.`;
      }
    }
    if (control.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Digite um e-mail válido, como nome@exemplo.com.';
    }
    if (/(^uf|estado)/i.test(name) && !/^[A-Z]{2}$/i.test(value)) {
      return 'Informe a UF com duas letras, por exemplo GO.';
    }

    return '';
  };

  const createToastRegion = () => {
    let region = document.querySelector('.premium-toast-region');
    if (region) return region;
    region = document.createElement('div');
    region.className = 'premium-toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.append(region);
    return region;
  };

  const showToast = (message, tone = 'success') => {
    const region = createToastRegion();
    const toast = document.createElement('div');
    toast.className = `premium-toast premium-toast--${tone}`;
    toast.innerHTML = `<span aria-hidden="true">${tone === 'error' ? '!' : '✓'}</span><p>${message}</p>`;
    region.append(toast);
    window.setTimeout(() => toast.classList.add('is-visible'), 20);
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 250);
    }, 3600);
  };

  const createModal = (className, labelId) => {
    const modal = document.createElement('div');
    modal.className = `premium-modal ${className}`;
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', labelId);
    modal.innerHTML = '<div class="premium-modal-backdrop" data-modal-close></div><div class="premium-modal-panel" role="document"></div>';
    document.body.append(modal);
    return modal;
  };

  const openModal = (modal, focusTarget) => {
    modal.hidden = false;
    document.body.classList.add('premium-modal-open');
    window.requestAnimationFrame(() => {
      modal.classList.add('is-open');
      focusTarget?.focus();
    });
  };

  const closeModal = (modal) => {
    modal.classList.remove('is-open');
    document.body.classList.remove('premium-modal-open');
    window.setTimeout(() => {
      modal.hidden = true;
    }, reduceMotion ? 0 : 180);
  };

  // Exposto para outros módulos (ex.: signature-editor.js) reaproveitarem o
  // mesmo visual de modal usado pela revisão e pelo sucesso do formulário.
  window.MegaModal = { create: createModal, open: openModal, close: closeModal };

  const initializeForm = (form) => {
    if (form.dataset.premiumReady === 'true') return;
    form.dataset.premiumReady = 'true';
    form.classList.add('premium-form');
    form.noValidate = true;

    const title = cleanText(document.querySelector('.procura-header h1')?.textContent) || 'Documento';
    const intros = [...form.querySelectorAll(':scope > .form-intro')];
    if (intros.length < 2) return;

    const originalGroups = intros.map((intro, index) => {
      const nodes = [];
      const nextIntro = intros[index + 1];
      let cursor = intro;
      while (cursor && cursor !== nextIntro && !cursor.matches('.form-check, .form-actions')) {
        nodes.push(cursor);
        cursor = cursor.nextElementSibling;
      }
      return nodes;
    });

    const panels = originalGroups.map((nodes, index) => {
      const panel = document.createElement('section');
      panel.className = 'premium-step';
      panel.dataset.step = String(index);
      panel.setAttribute('aria-labelledby', `premium-step-title-${form.id}-${index}`);
      form.insertBefore(panel, nodes[0]);
      nodes.forEach((node) => panel.append(node));

      const heading = panel.querySelector('.form-intro strong');
      if (heading) heading.id = `premium-step-title-${form.id}-${index}`;
      return panel;
    });

    const confirmation = form.querySelector(':scope > .form-check');
    const formActions = form.querySelector(':scope > .form-actions');
    if (confirmation) panels.at(-1).append(confirmation);
    if (formActions) panels.at(-1).append(formActions);

    const stepNames = panels.map((panel) => cleanText(panel.querySelector('.form-intro strong')?.textContent));
    const progress = document.createElement('div');
    progress.className = 'premium-progress';
    progress.innerHTML = `
      <div class="premium-progress-top">
        <div>
          <span class="premium-kicker">PREENCHIMENTO GUIADO</span>
          <strong data-progress-label>Etapa 1 de ${panels.length}</strong>
        </div>
        <div class="premium-progress-actions">
          <span class="premium-save-status" data-save-status><i aria-hidden="true"></i> Rascunho automático ativo</span>
        </div>
      </div>
      <div class="premium-progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="${panels.length}" aria-valuenow="1" aria-label="Progresso do formulário">
        <span data-progress-bar></span>
      </div>
      <div class="premium-step-tabs" aria-label="Etapas do formulário"></div>
    `;
    progress.style.setProperty('--step-count', String(panels.length));
    form.insertBefore(progress, panels[0]);

    const tabs = progress.querySelector('.premium-step-tabs');
    const tabButtons = stepNames.map((name, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'premium-step-tab';
      button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><small>${name}</small>`;
      button.setAttribute('aria-label', `Ir para a etapa ${index + 1}: ${name}`);
      tabs.append(button);
      return button;
    });

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.innerHTML = 'Revisar e gerar PDF <span>→</span>';
    const actionDescription = form.querySelector('.form-actions p');
    if (actionDescription) actionDescription.textContent = 'Você verá uma conferência final antes de gerar e baixar o documento.';

    // O botão de gerar PDF ganha o mesmo agrupamento usado pelo "Continuar",
    // para que o botão de limpar sempre pouse à esquerda dele, no mesmo padrão.
    let submitActions = null;
    if (submitButton && formActions) {
      submitActions = document.createElement('div');
      submitActions.className = 'premium-step-actions';
      formActions.insertBefore(submitActions, submitButton);
      submitActions.append(submitButton);
    }

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'premium-clear-button';
    clearButton.dataset.clearForm = '';
    clearButton.textContent = 'Limpar todos os campos';

    // Onde o botão de limpar deve pousar em cada etapa: sempre à esquerda do
    // botão de ação principal daquela etapa (Continuar, ou Revisar e gerar PDF na última).
    const clearButtonSlots = [];

    panels.forEach((panel, index) => {
      const navigation = document.createElement('div');
      navigation.className = 'premium-step-navigation';

      if (index > 0) {
        const previousButton = document.createElement('button');
        previousButton.type = 'button';
        previousButton.className = 'premium-nav-button premium-nav-button--back';
        previousButton.innerHTML = '<span aria-hidden="true">←</span> Voltar';
        previousButton.addEventListener('click', () => showStep(index - 1, true));
        navigation.append(previousButton);
      } else {
        navigation.append(document.createElement('span'));
      }

      if (index < panels.length - 1) {
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'button button-primary premium-nav-button';
        nextButton.innerHTML = 'Continuar <span aria-hidden="true">→</span>';
        nextButton.addEventListener('click', () => {
          const firstInvalid = validatePanel(panel, true);
          if (firstInvalid) {
            focusInvalid(firstInvalid);
            return;
          }
          showStep(index + 1, true);
        });
        const actions = document.createElement('div');
        actions.className = 'premium-step-actions';
        actions.append(nextButton);
        navigation.append(actions);
        panel.append(navigation);
        clearButtonSlots[index] = { parent: actions, before: nextButton };
      } else {
        panel.insertBefore(navigation, confirmation || formActions || null);
        if (submitButton) clearButtonSlots[index] = { parent: submitActions, before: submitButton };
      }
    });

    const aside = document.querySelector('.procura-aside');
    if (aside) {
      const asideTitle = aside.querySelector('strong');
      const asideList = aside.querySelector('ol');
      if (asideTitle) asideTitle.textContent = 'Preenchimento inteligente';
      if (asideList) {
        asideList.innerHTML = '<li>Avance por etapas e acompanhe seu progresso.</li><li>Seu rascunho fica salvo neste dispositivo.</li><li>Revise todos os dados antes de gerar o PDF.</li>';
      }
    }

    let currentStep = 0;
    let highestVisitedStep = 0;
    let allowOriginalSubmit = false;
    let saveTimer = 0;
    let suppressDraftSave = false;
    const storageKey = `mega-form-draft:v2:${window.location.pathname}:${form.id}`;
    const saveStatus = progress.querySelector('[data-save-status]');
    const controls = [...form.elements].filter((control) => (
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)
      && control.type !== 'hidden'
      && control.type !== 'submit'
      && control.type !== 'button'
    ));

    const setSaveStatus = (message, state = '') => {
      saveStatus.className = `premium-save-status${state ? ` premium-save-status--${state}` : ''}`;
      saveStatus.innerHTML = `<i aria-hidden="true"></i> ${message}`;
    };

    const showStep = (index, shouldScroll = false) => {
      const nextIndex = Math.max(0, Math.min(index, panels.length - 1));
      currentStep = nextIndex;
      highestVisitedStep = Math.max(highestVisitedStep, nextIndex);

      panels.forEach((panel, panelIndex) => {
        panel.hidden = panelIndex !== nextIndex;
      });

      const slot = clearButtonSlots[nextIndex];
      if (slot?.parent) slot.parent.insertBefore(clearButton, slot.before || null);

      tabButtons.forEach((button, buttonIndex) => {
        button.classList.toggle('is-active', buttonIndex === nextIndex);
        button.classList.toggle('is-complete', buttonIndex < nextIndex);
        button.disabled = buttonIndex > highestVisitedStep;
        button.setAttribute('aria-current', buttonIndex === nextIndex ? 'step' : 'false');
      });

      const progressValue = nextIndex + 1;
      progress.querySelector('[data-progress-label]').textContent = `Etapa ${progressValue} de ${panels.length} · ${stepNames[nextIndex]}`;
      progress.querySelector('[data-progress-bar]').style.width = `${(progressValue / panels.length) * 100}%`;
      const track = progress.querySelector('[role="progressbar"]');
      track.setAttribute('aria-valuenow', String(progressValue));

      if (shouldScroll) {
        const behavior = reduceMotion ? 'auto' : 'smooth';
        progress.scrollIntoView({ behavior, block: 'start' });
        window.setTimeout(() => panel.querySelector('input:not([readonly]), select, textarea')?.focus({ preventScroll: true }), reduceMotion ? 0 : 280);
      }
      scheduleDraftSave();
    };

    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (index <= highestVisitedStep) showStep(index, true);
      });
    });

    const updateFieldState = (control, touched = false) => {
      if (control.disabled || control.readOnly || control.type === 'hidden') return true;
      if (touched) control.dataset.touched = 'true';

      control.setCustomValidity('');
      const message = validationMessage(control);
      control.setCustomValidity(message);
      const label = control.closest('label') || (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null);
      if (!label) return !message;

      let feedback = label.querySelector('.premium-field-message');
      if (message && control.dataset.touched === 'true') {
        if (!feedback) {
          feedback = document.createElement('small');
          feedback.className = 'premium-field-message';
          feedback.setAttribute('aria-live', 'polite');
          label.append(feedback);
        }
        feedback.classList.remove('premium-field-warning-message');
        feedback.textContent = message;
        label.classList.add('premium-field-invalid');
        label.classList.remove('premium-field-valid');
        label.classList.remove('premium-field-warning');
        control.setAttribute('aria-invalid', 'true');
      } else {
        feedback?.remove();
        label.classList.remove('premium-field-invalid');
        control.removeAttribute('aria-invalid');
        const hasValue = control.type === 'checkbox' ? control.checked : Boolean(cleanText(control.value));
        const showEmptyWarning = control.dataset.touched === 'true' && !hasValue && Boolean(control.dataset.warningEmpty);
        label.classList.toggle('premium-field-warning', showEmptyWarning);
        label.classList.toggle('premium-field-valid', control.dataset.touched === 'true' && hasValue && !message);
        if (showEmptyWarning) {
          feedback = document.createElement('small');
          feedback.className = 'premium-field-message premium-field-warning-message';
          feedback.setAttribute('aria-live', 'polite');
          feedback.textContent = control.dataset.warningEmpty;
          label.append(feedback);
        }
      }

      return !message;
    };

    function validatePanel(panel, touchFields = false) {
      const panelControls = controls.filter((control) => panel.contains(control));
      let firstInvalid = null;
      panelControls.forEach((control) => {
        const valid = updateFieldState(control, touchFields);
        if (!valid && !firstInvalid) firstInvalid = control;
      });
      return firstInvalid;
    }

    const validateAll = () => {
      let firstInvalid = null;
      panels.forEach((panel) => {
        const invalid = validatePanel(panel, true);
        if (invalid && !firstInvalid) firstInvalid = invalid;
      });
      return firstInvalid;
    };

    const focusInvalid = (control) => {
      const panelIndex = panels.findIndex((panel) => panel.contains(control));
      if (panelIndex >= 0) showStep(panelIndex);
      control.focus({ preventScroll: true });
      control.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      showToast(`Confira o campo “${fieldLabel(control)}”.`, 'error');
    };

    // Exposto no próprio elemento do formulário para outros módulos (ex.:
    // signature-editor.js) reaproveitarem essa mesma validação por etapas —
    // inclusive navegando até a etapa certa — sem duplicar a lógica aqui.
    form.megaValidateForEditor = () => {
      const firstInvalid = validateAll();
      if (firstInvalid) {
        focusInvalid(firstInvalid);
        return false;
      }
      return true;
    };

    const serializeDraft = () => {
      const values = {};
      controls.forEach((control) => {
        if (!control.name || control.readOnly || control.type === 'checkbox') return;
        values[control.name] = control.value;
      });
      return { updatedAt: Date.now(), currentStep, values };
    };

    const saveDraft = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(serializeDraft()));
        setSaveStatus('Rascunho salvo agora', 'saved');
      } catch {
        setSaveStatus('Salvamento indisponível', 'error');
      }
    };

    function scheduleDraftSave() {
      if (suppressDraftSave) return;
      window.clearTimeout(saveTimer);
      setSaveStatus('Salvando rascunho...', 'saving');
      saveTimer = window.setTimeout(saveDraft, 420);
    }

    const restoreDraft = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (!saved?.updatedAt || Date.now() - saved.updatedAt > DRAFT_MAX_AGE) {
          localStorage.removeItem(storageKey);
          return;
        }

        controls.forEach((control) => {
          if (!control.name || control.readOnly || control.type === 'checkbox') return;
          if (!Object.prototype.hasOwnProperty.call(saved.values, control.name)) return;
          control.value = saved.values[control.name];
          control.dispatchEvent(new Event('input', { bubbles: true }));
          control.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const savedStep = Number.isInteger(saved.currentStep) ? saved.currentStep : 0;
        highestVisitedStep = Math.max(0, Math.min(savedStep, panels.length - 1));
        showStep(highestVisitedStep);
        setSaveStatus('Rascunho restaurado', 'restored');
        showToast('Seu preenchimento anterior foi restaurado.');
      } catch {
        localStorage.removeItem(storageKey);
      }
    };

    controls.forEach((control) => {
      control.addEventListener('blur', () => updateFieldState(control, true));
      control.addEventListener('input', () => {
        window.queueMicrotask(() => updateFieldState(control, control.dataset.touched === 'true'));
        scheduleDraftSave();
      });
      control.addEventListener('change', () => {
        window.queueMicrotask(() => updateFieldState(control, control.dataset.touched === 'true'));
        scheduleDraftSave();
      });
    });

    clearButton.addEventListener('click', () => {
      const shouldClear = window.confirm('Limpar todos os campos? Os dados preenchidos e o rascunho salvo neste dispositivo serão apagados.');
      if (!shouldClear) return;

      suppressDraftSave = true;
      window.clearTimeout(saveTimer);
      form.reset();

      controls.forEach((control) => {
        if (!control.readOnly) {
          if (control.type === 'checkbox' || control.type === 'radio') {
            control.checked = false;
          } else if (control.tagName === 'SELECT') {
            control.selectedIndex = 0;
          } else {
            control.value = '';
          }
        }

        control.setCustomValidity('');
        delete control.dataset.touched;
        control.removeAttribute('aria-invalid');

        const label = control.closest('label')
          || (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null);
        label?.classList.remove('premium-field-invalid', 'premium-field-valid', 'premium-field-warning');
        label?.querySelector('.premium-field-message')?.remove();

        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      });

      try {
        localStorage.removeItem(storageKey);
      } catch {
        // O formulário ainda pode ser limpo quando o armazenamento do navegador está indisponível.
      }

      highestVisitedStep = 0;
      showStep(0, true);
      setSaveStatus('Campos e rascunho limpos', 'saved');
      showToast('Todos os campos e o rascunho foram limpos.');
      suppressDraftSave = false;
    });

    const reviewModal = createModal('premium-review-modal', `premium-review-title-${form.id}`);
    const reviewPanel = reviewModal.querySelector('.premium-modal-panel');

    const closeReview = () => closeModal(reviewModal);
    reviewModal.querySelector('[data-modal-close]').addEventListener('click', closeReview);

    const reviewValue = (control) => {
      if (control.type === 'checkbox') return control.checked ? 'Confirmado' : 'Não confirmado';
      if (control.tagName === 'SELECT') return cleanText(control.selectedOptions[0]?.textContent);
      if (control.type === 'date' && control.value) {
        const [year, month, day] = control.value.split('-');
        return `${day}/${month}/${year}`;
      }
      return cleanText(control.value);
    };

    const showReview = () => {
      const groups = panels.map((panel, panelIndex) => {
        const items = controls
          .filter((control) => panel.contains(control) && control.type !== 'checkbox')
          .map((control) => ({ label: fieldLabel(control), value: reviewValue(control) }))
          .filter((item) => item.value);
        return { title: stepNames[panelIndex], items };
      }).filter((group) => group.items.length);

      reviewPanel.innerHTML = `
        <div class="premium-modal-header">
          <span class="premium-modal-icon" aria-hidden="true">✓</span>
          <div>
            <span class="premium-kicker">ÚLTIMA CONFERÊNCIA</span>
            <h2 id="premium-review-title-${form.id}">Revise antes de gerar</h2>
            <p>Confira os dados do seu documento. Se algo estiver errado, volte e ajuste.</p>
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
        const list = document.createElement('dl');
        group.items.forEach((item) => {
          const wrapper = document.createElement('div');
          const term = document.createElement('dt');
          const description = document.createElement('dd');
          term.textContent = item.label;
          description.textContent = item.value;
          wrapper.append(term, description);
          list.append(wrapper);
        });
        section.append(list);
        groupsContainer.append(section);
      });

      reviewPanel.querySelector('.premium-modal-close').addEventListener('click', closeReview);
      reviewPanel.querySelector('.premium-review-edit').addEventListener('click', closeReview);
      const confirmButton = reviewPanel.querySelector('.premium-review-confirm');
      confirmButton.addEventListener('click', () => {
        closeReview();
        allowOriginalSubmit = true;
        form.requestSubmit(submitButton);
        allowOriginalSubmit = false;
      });

      openModal(reviewModal, confirmButton);
    };

    form.addEventListener('submit', (event) => {
      if (allowOriginalSubmit) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const firstInvalid = validateAll();
      if (firstInvalid) {
        focusInvalid(firstInvalid);
        return;
      }
      showReview();
    }, true);

    const setGenerating = (generating) => {
      if (!submitButton) return;
      if (generating) {
        submitButton.dataset.originalHtml = submitButton.innerHTML;
        submitButton.innerHTML = '<span class="premium-spinner" aria-hidden="true"></span> Preparando PDF...';
        submitButton.disabled = true;
      } else {
        submitButton.innerHTML = submitButton.dataset.originalHtml || 'Revisar e gerar PDF <span>→</span>';
        submitButton.disabled = false;
      }
    };

    const successModal = createModal('premium-success-modal', `premium-success-title-${form.id}`);
    const successPanel = successModal.querySelector('.premium-modal-panel');

    const openWhatsApp = (fileName) => {
      const message = `Olá! Acabei de gerar o documento “${title}” (${fileName}) no site da MEGA e gostaria de enviá-lo para atendimento. Vou anexar o PDF nesta conversa.`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    };

    const showSuccess = (detail) => {
      setGenerating(false);
      try {
        localStorage.removeItem(storageKey);
        setSaveStatus('Documento concluído', 'saved');
      } catch {
        // O download já foi concluído; a limpeza do rascunho é apenas um cuidado adicional.
      }

      const fileName = detail?.fileName || 'documento-mega.pdf';
      successPanel.innerHTML = `
        <div class="premium-success-check" aria-hidden="true"><span>✓</span></div>
        <span class="premium-kicker">DOWNLOAD CONCLUÍDO</span>
        <h2 id="premium-success-title-${form.id}">Seu documento está pronto!</h2>
        <p>O PDF foi baixado com segurança. Agora você pode assinar e enviar para a equipe da MEGA.</p>
        <div class="premium-success-file"><span aria-hidden="true">PDF</span><div><strong>${fileName}</strong><small>Salvo na pasta de downloads</small></div></div>
        <div class="premium-success-actions">
          <button type="button" class="button button-primary premium-share-document">Enviar documento para a MEGA <span aria-hidden="true">→</span></button>
          <button type="button" class="premium-nav-button premium-success-close">Fechar</button>
        </div>
        <small class="premium-share-note">Em celulares compatíveis, você poderá compartilhar o próprio PDF. Nos demais casos, abriremos o WhatsApp para você anexar o arquivo baixado.</small>
      `;

      const closeButton = successPanel.querySelector('.premium-success-close');
      closeButton.addEventListener('click', () => closeModal(successModal));
      successModal.querySelector('[data-modal-close]').onclick = () => closeModal(successModal);

      successPanel.querySelector('.premium-share-document').addEventListener('click', async () => {
        const file = window.MEGA_LAST_DOCUMENT;
        try {
          if (file && navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `${title} | MEGA Despachante`,
              text: 'Documento gerado no site da MEGA Despachante.',
            });
            return;
          }
          openWhatsApp(fileName);
        } catch (error) {
          if (error?.name !== 'AbortError') openWhatsApp(fileName);
        }
      });

      openModal(successModal, successPanel.querySelector('.premium-share-document'));
    };

    window.addEventListener('mega:pdf-start', () => {
      setGenerating(true);
      showToast('Estamos preparando seu PDF com segurança.');
    });
    window.addEventListener('mega:pdf-success', (event) => showSuccess(event.detail));
    window.addEventListener('mega:pdf-error', () => {
      setGenerating(false);
      showToast('Não foi possível gerar o PDF agora. Tente novamente.', 'error');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!reviewModal.hidden) closeReview();
      if (!successModal.hidden) closeModal(successModal);
    });

    showStep(0);
    window.setTimeout(restoreDraft, 0);
  };

  forms.forEach(initializeForm);
})();
