const declaracaoResidenciaForm = document.getElementById('declaracao-residencia-form');

if (declaracaoResidenciaForm) {
  const onlyNumbers = (value) => value.replace(/\D/g, '');
  const formatCpf = (value) => onlyNumbers(value).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  const formatPhone = (value) => onlyNumbers(value).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  const formatDate = (value) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));

  declaracaoResidenciaForm.elements.dataAssinatura.value = new Date().toISOString().slice(0, 10);

  declaracaoResidenciaForm.querySelectorAll('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.mask === 'cpf') input.value = formatCpf(input.value);
      if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
      if (input.dataset.mask === 'telefone') input.value = formatPhone(input.value);
    });
  });

  const cepInput = declaracaoResidenciaForm.elements.cep;
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
      declaracaoResidenciaForm.elements.endereco.value = address.logradouro || '';
      declaracaoResidenciaForm.elements.bairro.value = address.bairro || '';
      declaracaoResidenciaForm.elements.cidade.value = address.localidade || '';
      declaracaoResidenciaForm.elements.estado.value = address.uf || '';
      lastCepLookup = cep;
      setCepFeedback('Endereço preenchido. Confira os dados antes de gerar.');
      declaracaoResidenciaForm.elements.numero.focus();
    } catch (error) {
      lastCepLookup = '';
      setCepFeedback('Não foi possível encontrar este CEP. Preencha o endereço manualmente.', true);
    }
  };
  cepInput.addEventListener('blur', lookupCep);
  cepInput.addEventListener('input', () => {
    if (onlyNumbers(cepInput.value).length === 8) lookupCep();
  });

  declaracaoResidenciaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!declaracaoResidenciaForm.reportValidity()) return;

    const data = new FormData(declaracaoResidenciaForm);
    const locationParts = [
      data.get('quadra') && `Quadra ${valueOf(data, 'quadra')}`,
      data.get('lote') && `Lote ${valueOf(data, 'lote')}`,
      `Nº ${valueOf(data, 'numero')}`,
      data.get('complemento') && valueOf(data, 'complemento'),
      valueOf(data, 'bairro'),
      `${valueOf(data, 'cidade')}/${valueOf(data, 'estado')}`,
      `CEP ${valueOf(data, 'cep')}`,
      data.get('foneFixo') && `Fone fixo ${valueOf(data, 'foneFixo')}`,
      data.get('celular') && `Celular ${valueOf(data, 'celular')}`,
    ].filter(Boolean).join(', ');
    const logoUrl = new URL('assets/logo-mega-transparent.png', window.location.href).href;
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }

    preview.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="UTF-8"><title>Declaração de residência</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #eee; color: #151515; font-family: Arial, sans-serif; }
        .document { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; padding: 15mm 18mm; background: #fff; font-size: 10pt; line-height: 1.46; }
        .logo-symbol { position: absolute; top: 12mm; right: 18mm; width: 20mm; height: 20mm; object-fit: contain; }
        .heading { margin: 20mm 25mm 28mm; text-align: center; font-size: 14pt; font-weight: 400; }.heading span { display: block; margin-top: 17px; font-size: 15pt; }
        .declaration { text-align: justify; }.declaration p { margin: 0; text-indent: 20mm; }
        .signature { width: 125mm; margin: 43mm auto 0; text-align: center; }.signature .place-date { display: flex; justify-content: space-between; margin-bottom: 35mm; text-align: left; }.signature .line { border-top: 1px solid #222; margin-bottom: 4px; }
        .print-hint { position: fixed; z-index: 10; top: 18px; right: 18px; border: 0; background: #b42313; color: #fff; padding: 12px 16px; font-weight: 700; cursor: pointer; }
        @media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body>
      <button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button>
      <article class="document">
        <img class="logo-symbol" src="${logoUrl}" alt="MEGA Despachante">
        <h1 class="heading">ANEXO I<span>DECLARAÇÃO DE RESIDÊNCIA</span></h1>
        <section class="declaration"><p>EU, <strong>${valueOf(data, 'nome')}</strong>, portador(a) da Carteira de Identidade nº <strong>${valueOf(data, 'identidade')}</strong>, órgão emissor <strong>${valueOf(data, 'orgaoEmissor')}</strong>, Unidade Federativa <strong>${valueOf(data, 'ufEmissao')}</strong>, e do CPF nº <strong>${valueOf(data, 'cpf')}</strong>, DECLARO que resido à Rua/Av. <strong>${valueOf(data, 'endereco')}</strong>, ${locationParts} e RESPONSABILIZO-ME, sob as penas da lei penal, civil e administrativa, pela autenticidade do endereço acima transcrito, cuja declaração de endereço representa a expressão da verdade, sujeitando-me às sanções estabelecidas no art. 299, do Código Penal (falsificação ideológica), e no art. 242, do Código de Trânsito Brasileiro (infração gravíssima, multa e 7 (sete) pontos na ACC, Permissão para Dirigir/CNH do(a) declarante), caso seja configurada falsa a declaração.</p></section>
        <section class="signature"><div class="place-date"><span>${valueOf(data, 'cidadeAssinatura')}<br><small>Local</small></span><span>${formatDate(data.get('dataAssinatura'))}<br><small>Data</small></span></div><div class="line"></div><strong>${valueOf(data, 'nome')}</strong><br>Assinatura do(a) Declarante</section>
      </article></body></html>`);
    preview.document.close();
  });
}
