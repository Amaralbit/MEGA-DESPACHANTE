const requerimentoAlteracaoForm = document.getElementById('requerimento-alteracao-form');

if (requerimentoAlteracaoForm) {
  const onlyNumbers = (value) => value.replace(/\D/g, '');
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));
  const formatCpfCnpj = (value) => {
    const digits = onlyNumbers(value).slice(0, 14);
    if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };
  const formatPhone = (value) => onlyNumbers(value).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  const formattedDate = (value) => {
    const [year, month, day] = value.split('-');
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${day} de ${months[Number(month) - 1]} de ${year}`;
  };

  requerimentoAlteracaoForm.elements.dataAssinatura.value = new Date().toISOString().slice(0, 10);
  requerimentoAlteracaoForm.querySelectorAll('[data-mask]').forEach((input) => input.addEventListener('input', () => {
    if (input.dataset.mask === 'cpf-cnpj') input.value = formatCpfCnpj(input.value);
    if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
    if (input.dataset.mask === 'placa') input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (input.dataset.mask === 'telefone') input.value = formatPhone(input.value);
  }));

  const cepInput = requerimentoAlteracaoForm.elements.cep;
  const cepFeedback = document.getElementById('cep-feedback');
  let lastCepLookup = '';
  const setCepFeedback = (message, isError = false) => { cepFeedback.textContent = message; cepFeedback.classList.toggle('error', isError); };
  const lookupCep = async () => {
    const cep = onlyNumbers(cepInput.value);
    if (cep.length !== 8 || cep === lastCepLookup) return;
    setCepFeedback('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('CEP inválido');
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado');
      requerimentoAlteracaoForm.elements.logradouro.value = address.logradouro || '';
      requerimentoAlteracaoForm.elements.bairro.value = address.bairro || '';
      requerimentoAlteracaoForm.elements.municipio.value = address.localidade || '';
      requerimentoAlteracaoForm.elements.uf.value = address.uf || '';
      lastCepLookup = cep;
      setCepFeedback('Endereço preenchido. Confira os dados antes de gerar.');
    } catch (error) {
      lastCepLookup = '';
      setCepFeedback('Não foi possível encontrar este CEP. Preencha o endereço manualmente.', true);
    }
  };
  cepInput.addEventListener('blur', lookupCep);
  cepInput.addEventListener('input', () => { if (onlyNumbers(cepInput.value).length === 8) lookupCep(); });

  requerimentoAlteracaoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!requerimentoAlteracaoForm.reportValidity()) return;
    const data = new FormData(requerimentoAlteracaoForm);
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) { window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.'); return; }
    preview.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Requerimento para alteração de característica veicular</title><style>
      @page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; } body { margin: 0; background: #eee; color: #000; font-family: Arial, sans-serif; }
      .document { width: 210mm; min-height: 297mm; margin: 10px auto; padding: 11mm 13mm 9mm; background: #fff; font-size: 8.1pt; line-height: 1.2; }.title { margin: 0; padding: 4px 10px; border: 1px solid #000; background: #f0f0f0; text-align: center; font-size: 12pt; font-weight: 700; }.recipient { margin: 7px 9px 10px; text-align: center; font-size: 8.3pt; }.section { margin-top: 8px; font-weight: 700; }.grid { display: grid; border: 1px solid #000; border-bottom: 0; }.grid > div { min-height: 27px; padding: 4px 5px; border-right: 1px solid #000; border-bottom: 1px solid #000; overflow-wrap: anywhere; }.grid > div:last-child { border-right: 0; }.grid b { display: block; margin-bottom: 2px; font-size: 7.1pt; }.owner-one { grid-template-columns: 1fr; }.owner-two { grid-template-columns: 1.1fr .75fr 1fr; }.address-one { grid-template-columns: .7fr 1.45fr; }.address-two { grid-template-columns: 1.6fr .45fr; }.address-three { grid-template-columns: 1fr 1.1fr; }.address-four { grid-template-columns: 1.3fr .35fr; }.vehicle-one { grid-template-columns: .55fr 1.45fr; }.vehicle-two { grid-template-columns: 1fr; }.request-box { min-height: 66px; padding: 6px; border: 1px solid #000; white-space: pre-wrap; overflow-wrap: anywhere; }.body-copy { margin: 9px 0 0; text-align: justify; line-height: 1.35; }.date { margin: 20px 0 25px; text-align: center; }.signature { width: 92mm; margin: 0 auto; padding-top: 4px; border-top: 1px solid #000; text-align: center; font-weight: 700; }.print-hint { position: fixed; z-index: 10; top: 18px; right: 18px; border: 0; background: #b42313; color: #fff; padding: 12px 16px; font-weight: 700; cursor: pointer; } @media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body><button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button><article class="document">
      <h1 class="title">REQUERIMENTO PARA ALTERAÇÃO DE CARACTERÍSTICAS VEICULAR</h1><p class="recipient">Ilmo(a) Sr(a), Presidente da Comissão para Alteração de Característica Veicular</p>
      <p class="section">Identificação do(a) Proprietário(a):</p><section class="grid owner-one"><div><b>Nome:</b>${valueOf(data, 'proprietario')}</div></section><section class="grid owner-two"><div><b>CPF/CNPJ:</b>${valueOf(data, 'cpfCnpj')}</div><div><b>RG:</b>${valueOf(data, 'rg')}</div><div><b>Órgão Expeditor:</b>${valueOf(data, 'orgaoExpedidor')}</div></section>
      <p class="section">Endereço do(a) Proprietário(a):</p><section class="grid address-one"><div><b>CEP:</b>${valueOf(data, 'cep')}</div><div><b>Telefones:</b>${valueOf(data, 'telefone')}</div></section><section class="grid address-two"><div><b>Rua, Avenida, Praça, etc:</b>${valueOf(data, 'logradouro')}</div><div><b>Nº</b>${valueOf(data, 'numero')}</div></section><section class="grid address-three"><div><b>Andar, sala, etc:</b>${valueOf(data, 'complemento')}</div><div><b>Bairro/Distrito:</b>${valueOf(data, 'bairro')}</div></section><section class="grid address-four"><div><b>Município:</b>${valueOf(data, 'municipio')}</div><div><b>UF:</b>${valueOf(data, 'uf')}</div></section><section class="grid owner-one"><div><b>E-mail:</b>${valueOf(data, 'email')}</div></section>
      <p class="section">Dados do Veículo:</p><section class="grid vehicle-one"><div><b>Placa:</b>${valueOf(data, 'placa')}</div><div><b>Marca/Modelo:</b>${valueOf(data, 'marcaModelo')}</div></section><section class="grid vehicle-two"><div><b>Chassi:</b>${valueOf(data, 'chassi')}</div></section>
      <p class="section">Alteração Pretendida:</p><div class="request-box">${valueOf(data, 'alteracao')}</div><p class="section">Requerimento:</p><p class="body-copy">O(A) abaixo assinado(a), requer o desbloqueio do laudo de vistoria, tendo em vista a documentação em anexo, por esta estar de acordo com as exigências contidas na Portaria nº 91/2004.</p><p class="body-copy">Declaro ainda, ser autêntica e verdadeira toda a documentação apresentada. Responsabilizo-me, sob as penas da Lei Civil e Criminal, pela presente requisição.</p><p class="body-copy">Nestes termos, pede deferimento.</p><p class="date">${valueOf(data, 'cidadeAssinatura')}, ${formattedDate(data.get('dataAssinatura'))}.</p><div class="signature">${valueOf(data, 'proprietario')}<br />Assinatura do(a) proprietário(a) ou representante legal</div>
      </article></body></html>`);
    preview.document.close();
  });
}
