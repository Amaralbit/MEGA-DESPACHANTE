const intencaoVendaForm = document.getElementById('intencao-venda-form');

if (intencaoVendaForm) {
  const onlyNumbers = (value) => value.replace(/\D/g, '');
  const formatCpfCnpj = (value) => {
    const digits = onlyNumbers(value).slice(0, 14);
    if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };
  const formatPhone = (value) => onlyNumbers(value).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  const formatDate = (value) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));

  intencaoVendaForm.elements.dataAssinatura.value = new Date().toISOString().slice(0, 10);

  intencaoVendaForm.querySelectorAll('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.mask === 'cpf-cnpj') input.value = formatCpfCnpj(input.value);
      if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
      if (input.dataset.mask === 'placa') input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (input.dataset.mask === 'telefone') input.value = formatPhone(input.value);
    });
  });

  const setupCepLookup = ({ cep, address, city, state, feedback }) => {
    let lastCep = '';
    const setFeedback = (message, isError = false) => {
      feedback.textContent = message;
      feedback.classList.toggle('error', isError);
    };
    const lookup = async () => {
      const postalCode = onlyNumbers(cep.value);
      if (postalCode.length !== 8 || postalCode === lastCep) return;
      setFeedback('Buscando endereço...');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`);
        if (!response.ok) throw new Error('CEP inválido');
        const result = await response.json();
        if (result.erro) throw new Error('CEP não encontrado');
        if (!address.value) address.value = result.logradouro || '';
        city.value = result.localidade || city.value;
        state.value = result.uf || state.value;
        lastCep = postalCode;
        setFeedback('Cidade e UF preenchidas. Confira os dados antes de gerar.');
      } catch (error) {
        lastCep = '';
        setFeedback('Não foi possível encontrar este CEP. Preencha os dados manualmente.', true);
      }
    };
    cep.addEventListener('blur', lookup);
    cep.addEventListener('input', () => {
      if (onlyNumbers(cep.value).length === 8) lookup();
    });
  };

  setupCepLookup({ cep: intencaoVendaForm.elements.cepVendedor, address: intencaoVendaForm.elements.enderecoVendedor, city: intencaoVendaForm.elements.cidadeVendedor, state: intencaoVendaForm.elements.estadoVendedor, feedback: document.getElementById('cep-vendedor-feedback') });
  setupCepLookup({ cep: intencaoVendaForm.elements.cepComprador, address: intencaoVendaForm.elements.enderecoComprador, city: intencaoVendaForm.elements.cidadeComprador, state: intencaoVendaForm.elements.estadoComprador, feedback: document.getElementById('cep-comprador-feedback') });

  intencaoVendaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!intencaoVendaForm.reportValidity()) return;

    const data = new FormData(intencaoVendaForm);
    const date = formatDate(data.get('dataAssinatura'));
    const quadraLote = [
      data.get('quadraVendedor') && `Qd. ${valueOf(data, 'quadraVendedor')}`,
      data.get('loteVendedor') && `Lt. ${valueOf(data, 'loteVendedor')}`,
    ].filter(Boolean).join(', ');
    const vendorAddress = `${valueOf(data, 'enderecoVendedor')}, ${valueOf(data, 'numeroVendedor')}${data.get('complementoVendedor') ? ` - ${valueOf(data, 'complementoVendedor')}` : ''}, ${quadraLote ? `${quadraLote}, ` : ''}${valueOf(data, 'bairroVendedor')}, ${valueOf(data, 'cidadeVendedor')}/${valueOf(data, 'estadoVendedor')} - CEP ${valueOf(data, 'cepVendedor')}`;
    const logoUrl = new URL('assets/logo-mega-transparent.png', window.location.href).href;
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }

    preview.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="UTF-8"><title>Procuração - Intenção de venda</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #eee; color: #151515; font-family: Arial, sans-serif; }
        .document { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; padding: 10mm 14mm; background: #fff; font-size: 8.55pt; line-height: 1.23; }
        .logo-symbol { position: absolute; top: 9mm; right: 14mm; width: 18mm; height: 18mm; object-fit: contain; }
        .heading { margin: 0 24mm 8px; text-align: center; text-transform: uppercase; font-size: 14pt; line-height: 1.14; }.heading span { display: block; margin-top: 3px; font-size: 12pt; text-decoration: underline; }
        p { margin: 0 0 6px; text-align: justify; }.lead { margin-bottom: 7px; }
        .vehicle { margin: 7px 0; padding: 5px 7px; border-top: 1px solid #777; border-bottom: 1px solid #777; font-size: 8.2pt; }.vehicle div { margin: 2px 0; }
        .buyer-title { margin: 9px 0 6px; text-align: center; font-size: 12pt; text-decoration: underline; }
        .buyer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; margin: 6px 0 9px; font-size: 8.25pt; }.buyer-grid .wide { grid-column: 1 / -1; }.buyer-grid div { border-bottom: 1px solid #555; min-height: 15px; }.buyer-grid b { font-size: 7.8pt; }
        .closing { display: grid; grid-template-columns: 1fr 44mm; gap: 11mm; align-items: end; margin-top: 10px; }.signature { text-align: center; }.signature p { text-align: left; margin-bottom: 20px; }.signature-line { border-top: 1px solid #222; margin-bottom: 4px; }
        .declaration { border-left: 1px solid #777; padding-left: 7px; font-size: 7pt; line-height: 1.16; }.declaration strong { display: block; text-align: center; margin-bottom: 4px; font-size: 7.6pt; }.declaration .dispatch-line { border-top: 1px solid #222; margin: 20px 0 3px; }.declaration .dispatch-name { text-align: center; font-weight: 700; }
        .print-hint { position: fixed; top: 18px; right: 18px; border: 0; background: #b42313; color: #fff; padding: 12px 16px; font-weight: 700; cursor: pointer; }
        @media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body>
      <button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button>
      <article class="document">
        <img class="logo-symbol" src="${logoUrl}" alt="MEGA Despachante">
        <h1 class="heading">Procuração<span>Intenção de venda e emissão ATPV-E</span></h1>
        <p class="lead">Pelo presente instrumento de procuração, o(a) <strong>PROPRIETÁRIO(A) VENDEDOR(A)</strong>, <strong>${valueOf(data, 'vendedor')}</strong>, ${valueOf(data, 'estadoCivil')}, inscrito(a) no CPF/CNPJ sob nº ${valueOf(data, 'cpfCnpjVendedor')}, portador(a) da identidade nº ${valueOf(data, 'identidadeVendedor')} - ${valueOf(data, 'orgaoVendedor')}, residente e domiciliado(a) em ${vendorAddress}, e-mail ${valueOf(data, 'emailVendedor')}${data.get('telefoneVendedor') ? `, celular ${valueOf(data, 'telefoneVendedor')}` : ''}.</p>
        <p>Nomeia e constitui seu bastante procurador, o Escritório de <strong>MEGA DESPACHANTE</strong>, código <strong>2009</strong>, com sede à <strong>Rua T-37, Nº 2695, Setor Bueno, na cidade de Goiânia</strong>, para como se presente fosse, representá-lo junto ao DETRAN/GO, para solicitação dos serviços de <strong>INCLUSÃO DE INTENÇÃO DE VENDA</strong> ou <strong>CANCELAMENTO DE INTENÇÃO DE VENDA</strong> e/ou <strong>EMISSÃO DA ATPV-E</strong>, do veículo abaixo discriminado:</p>
        <section class="vehicle"><div><strong>Marca / modelo:</strong> ${valueOf(data, 'marcaModelo')}</div><div><strong>Ano fabricação/modelo:</strong> ${valueOf(data, 'anoFabricacao')}/${valueOf(data, 'anoModelo')}</div><div><strong>Placa:</strong> ${valueOf(data, 'placa')}</div><div><strong>Chassi:</strong> ${valueOf(data, 'chassi')}</div></section>
        <p>Podendo, para tanto, requerer e assinar o que necessário for, efetuar pagamentos, receber e dar quitações, alegar, concordar, discordar, prestar declarações e informações, enfim, praticar quaisquer outros atos que se fizerem necessários para o fiel cumprimento deste mandato, o que desde já fica dado por firme e valioso.</p>
        <h2 class="buyer-title">Dados comprador</h2>
        <p>Declaro ainda que os dados abaixo são a expressão da verdade, tendo sido captados e informados por mim, assumindo a inteira responsabilidade perante eles e isentando o despachante contratado de qualquer infortúnio:</p>
        <section class="buyer-grid"><div class="wide"><b>COMPRADOR:</b> ${valueOf(data, 'comprador')}</div><div><b>RG (Identidade):</b> ${valueOf(data, 'identidadeComprador')}</div><div><b>CPF/CNPJ:</b> ${valueOf(data, 'cpfCnpjComprador')}</div><div class="wide"><b>ENDEREÇO:</b> ${valueOf(data, 'enderecoComprador')}</div><div><b>MUNICÍPIO / UF:</b> ${valueOf(data, 'cidadeComprador')}/${valueOf(data, 'estadoComprador')}</div><div><b>CEP:</b> ${valueOf(data, 'cepComprador')}</div><div><b>E-MAIL:</b> ${valueOf(data, 'emailComprador')}</div><div><b>VALOR:</b> R$ ${valueOf(data, 'valorVenda')}</div></section>
        <section class="closing"><div class="signature"><p>${valueOf(data, 'cidadeAssinatura')}, ${date}.</p><div class="signature-line"></div><strong>${valueOf(data, 'vendedor')}</strong><br>Assinatura do Outorgante (Proprietário Vendedor)</div><aside class="declaration"><strong>Despachante MEGA<br>Cód. 2009-6</strong>Declaramos, sob as penas da lei, que a assinatura na procuração é de próprio punho do outorgante, feita em nossa presença, assumindo responsabilidade civil e criminal.<div class="dispatch-line"></div><div class="dispatch-name">Despachante MEGA</div></aside></section>
      </article></body></html>`);
    preview.document.close();
  });
}
