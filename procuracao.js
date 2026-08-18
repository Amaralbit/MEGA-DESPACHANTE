const procuracaoForm = document.getElementById('procuracao-form');

if (procuracaoForm) {
  const dateField = procuracaoForm.elements.dataAssinatura;
  dateField.value = new Date().toISOString().slice(0, 10);

  const onlyNumbers = (value) => value.replace(/\D/g, '');
  const formatCpfCnpj = (value) => {
    const digits = onlyNumbers(value).slice(0, 14);
    if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  procuracaoForm.querySelectorAll('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.mask === 'cpf-cnpj') input.value = formatCpfCnpj(input.value);
      if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
      if (input.dataset.mask === 'placa') input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  });

  const cepInput = procuracaoForm.elements.cep;
  const cepFeedback = document.getElementById('cep-feedback');
  let lastCepLookup = '';
  const setCepFeedback = (message, isError = false) => {
    cepFeedback.textContent = message;
    cepFeedback.classList.toggle('error', isError);
  };
  const lookupCep = async () => {
    const cep = onlyNumbers(cepInput.value);
    if (cep.length !== 8 || cep === lastCepLookup) return;
    setCepFeedback('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('CEP inválido');
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado');
      procuracaoForm.elements.endereco.value = address.logradouro || '';
      procuracaoForm.elements.bairro.value = address.bairro || '';
      procuracaoForm.elements.cidade.value = address.localidade || '';
      procuracaoForm.elements.estado.value = address.uf || '';
      lastCepLookup = cep;
      setCepFeedback('Endereço preenchido. Confira os dados antes de gerar.');
      procuracaoForm.elements.numero.focus();
    } catch (error) {
      lastCepLookup = '';
      setCepFeedback('Não foi possível encontrar este CEP. Preencha o endereço manualmente.', true);
    }
  };
  cepInput.addEventListener('blur', lookupCep);
  cepInput.addEventListener('input', () => {
    if (onlyNumbers(cepInput.value).length === 8) lookupCep();
  });

  // Sugestões para "Poderes concedidos": como é um <textarea>, o navegador não
  // guarda histórico sozinho (como faz com endereço, placa etc.), então
  // guardamos os últimos textos usados neste site e sugerimos ao focar/digitar.
  const servicoField = procuracaoForm.elements.servico;
  const servicoHistoryKey = `mega-field-history:v1:${window.location.pathname}:servico`;
  const loadServicoHistory = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(servicoHistoryKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  };
  const saveServicoHistory = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const history = [trimmed, ...loadServicoHistory().filter((item) => item !== trimmed)].slice(0, 6);
    localStorage.setItem(servicoHistoryKey, JSON.stringify(history));
  };
  const removeServicoHistoryItem = (value) => {
    const history = loadServicoHistory().filter((item) => item !== value);
    localStorage.setItem(servicoHistoryKey, JSON.stringify(history));
  };

  const servicoSuggestions = document.createElement('div');
  servicoSuggestions.className = 'field-suggestions';
  servicoSuggestions.hidden = true;
  servicoField.insertAdjacentElement('afterend', servicoSuggestions);

  const renderServicoSuggestions = () => {
    const query = servicoField.value.trim().toLowerCase();
    const matches = loadServicoHistory().filter((item) => item.toLowerCase() !== query && (!query || item.toLowerCase().includes(query)));
    servicoSuggestions.innerHTML = '';
    matches.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'field-suggestion-row';

      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'field-suggestion';
      option.textContent = item;
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        servicoField.value = item;
        servicoSuggestions.hidden = true;
        servicoField.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'field-suggestion-remove';
      removeButton.textContent = '×';
      removeButton.setAttribute('aria-label', `Remover sugestão "${item}"`);
      removeButton.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeServicoHistoryItem(item);
        renderServicoSuggestions();
      });

      row.appendChild(option);
      row.appendChild(removeButton);
      servicoSuggestions.appendChild(row);
    });
    servicoSuggestions.hidden = matches.length === 0;
  };
  servicoField.addEventListener('focus', renderServicoSuggestions);
  servicoField.addEventListener('input', renderServicoSuggestions);
  servicoField.addEventListener('blur', () => {
    setTimeout(() => { servicoSuggestions.hidden = true; }, 120);
  });

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));
  const nameOf = (data, key) => escapeHtml(String(data.get(key) || '').toLocaleUpperCase('pt-BR'));
  const formattedDate = (value) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  procuracaoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!procuracaoForm.reportValidity()) return;

    const data = new FormData(procuracaoForm);
    const outorgante = nameOf(data, 'outorgante');
    const date = formattedDate(data.get('dataAssinatura'));
    const city = valueOf(data, 'cidadeAssinatura');
    const powers = valueOf(data, 'servico');
    saveServicoHistory(String(data.get('servico') || ''));
    const validity = data.get('validade') ? ` Esta procuração terá validade de <strong>${valueOf(data, 'validade')}</strong>.` : '';
    const quadraLote = [
      data.get('quadra') && `Qd. <strong>${valueOf(data, 'quadra')}</strong>`,
      data.get('lote') && `Lt. <strong>${valueOf(data, 'lote')}</strong>`,
    ].filter(Boolean).join(', ');
    const address = `${valueOf(data, 'endereco')}, ${valueOf(data, 'numero')}${data.get('complemento') ? ` - ${valueOf(data, 'complemento')}` : ''}, ${quadraLote ? `${quadraLote}, ` : ''}${valueOf(data, 'bairro')}, ${valueOf(data, 'cidade')}/${valueOf(data, 'estado')} - CEP ${valueOf(data, 'cep')}`;
    const plate = data.get('placa') ? `placa ${valueOf(data, 'placa')}` : 'veículo novo, ainda sem placa';
    const vehicle = `${valueOf(data, 'marcaModelo')}, ano fabricação/modelo ${valueOf(data, 'anoFabricacao')}/${valueOf(data, 'anoModelo')}, cor ${valueOf(data, 'cor')}, ${plate}, chassi ${valueOf(data, 'chassi')}`;
    const identity = data.get('identidade') ? `, portador(a) do documento de identidade nº ${valueOf(data, 'identidade')}${data.get('orgao') ? ` - ${valueOf(data, 'orgao')}` : ''}` : '';
    const logoUrl = new URL('assets/logo-mega-transparent.png', window.location.href).href;
    const preview = window.createProtectedPdfPreview('procuracao-veiculo', 'procuracao-veiculo.pdf');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }

    preview.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="UTF-8"><title>Procuração para veículo</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #161616; margin: 0; background: #eee; }
        .document { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; background: #fff; padding: 13mm 15mm; font-size: 9.6pt; line-height: 1.36; }
        .logo-symbol { position: absolute; top: 5mm; right: 15mm; width: 18mm; height: 18mm; object-fit: contain; }
        .title { text-align: center; font-size: 14pt; font-weight: 700; margin: 12mm 0 16px; text-transform: uppercase; }
        .text { text-align: justify; }.text p { margin: 0 0 8px; }
        .signature { margin-top: 0; text-align: center; }.signature p { margin: 0; }
        .signature-line { width: 310px; border-top: 1px solid #222; margin: 100px auto 5px; }
        .vehicle-signature-footer .signature { margin-bottom: 260px; }
        ${window.MEGA_DECLARATION_CSS}
        .details { margin-top: 14px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8pt; color: #444; }.details strong { color: #111; }
        .print-hint { position: fixed; z-index: 10; right: 18px; top: 18px; background: #b42313; color: #fff; border: 0; padding: 12px 16px; cursor: pointer; font-weight: 700; }
        @media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body>
      <button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button>
      <article class="document">
        <img class="logo-symbol" src="${logoUrl}" alt="MEGA Despachante">
        <h1 class="title">Procuração para veículo</h1>
        <div class="text">
          <p><strong>OUTORGANTE:</strong> <strong>${outorgante}</strong>, inscrito(a) no CPF/CNPJ sob nº ${valueOf(data, 'cpfCnpj')}${identity}, residente e domiciliado(a) em ${address}.</p>
          <p>Pelo presente instrumento particular de procuração, nomeio e constituo como meu procurador <strong>${valueOf(data, 'despachante')}</strong>, código ${valueOf(data, 'codigoDespachante')}, com endereço em ${valueOf(data, 'enderecoDespachante')}, ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}, a quem são conferidos exclusivamente os poderes abaixo descritos.</p>
          <p><strong>VEÍCULO:</strong> ${vehicle}.</p>
          <p><strong>PODERES:</strong> Dando poderes para <strong>${powers}</strong>.${validity}</p>
          <p>Esta procuração é outorgada exclusivamente para os poderes acima descritos, responsabilizando-me pela veracidade das informações prestadas.</p>
        </div>
        <div class="details"><strong>Dados da MEGA Despachante:</strong> Código ${valueOf(data, 'codigoDespachante')} · ${valueOf(data, 'enderecoDespachante')} · ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}</div>
        <section class="signature-footer vehicle-signature-footer"><div class="signature"><p>${city}, ${date}.</p><div class="signature-line"></div><strong>${outorgante}</strong><br>Outorgante</div>
        ${window.renderMegaDeclaration(city, date)}</section>
      </article></body></html>`);
    preview.document.close();
  });
}
