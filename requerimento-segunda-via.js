const requerimentoSegundaViaForm = document.getElementById('requerimento-segunda-via-form');

if (requerimentoSegundaViaForm) {
  const onlyNumbers = (value) => value.replace(/\D/g, '');
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
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));

  requerimentoSegundaViaForm.elements.dataAssinatura.value = new Date().toISOString().slice(0, 10);
  requerimentoSegundaViaForm.querySelectorAll('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.mask === 'cpf-cnpj') input.value = formatCpfCnpj(input.value);
      if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
      if (input.dataset.mask === 'placa') input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (input.dataset.mask === 'telefone') input.value = formatPhone(input.value);
    });
  });

  const cepInput = requerimentoSegundaViaForm.elements.cep;
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
      requerimentoSegundaViaForm.elements.endereco.value = address.logradouro || '';
      requerimentoSegundaViaForm.elements.bairro.value = address.bairro || '';
      requerimentoSegundaViaForm.elements.cidade.value = address.localidade || '';
      requerimentoSegundaViaForm.elements.estado.value = address.uf || '';
      lastCepLookup = cep;
      setCepFeedback('Endereço preenchido. Confira os dados antes de gerar.');
    } catch (error) {
      lastCepLookup = '';
      setCepFeedback('Não foi possível encontrar este CEP. Preencha o endereço manualmente.', true);
    }
  };
  cepInput.addEventListener('blur', lookupCep);
  cepInput.addEventListener('input', () => {
    if (onlyNumbers(cepInput.value).length === 8) lookupCep();
  });

  requerimentoSegundaViaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!requerimentoSegundaViaForm.reportValidity()) return;
    const data = new FormData(requerimentoSegundaViaForm);
    const documentChoice = data.get('documento');
    const logoUrl = new URL('assets/logo-mega-transparent.png', window.location.href).href;
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }
    preview.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="UTF-8"><title>Requerimento 2ª via CRV / CRLV</title>
      <style>
        @page { size: A4 portrait; margin: 0; }* { box-sizing: border-box; }body { margin: 0; background: #eee; color: #121212; font-family: Arial, sans-serif; }.document { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; padding: 8mm 14mm 7mm; background: #fff; font-size: 8.3pt; line-height: 1.18; }.logo-symbol { position: absolute; top: 8mm; right: 14mm; width: 19mm; height: 19mm; object-fit: contain; }.heading { margin: 8mm 26mm 3mm 0; border-bottom: 2px solid #111; padding-bottom: 4px; text-align: center; font-size: 14pt; }.subtitle { margin: 0 26mm 8px 0; text-align: center; font-size: 7.7pt; font-weight: 700; }.to { margin: 0 0 10px; font-size: 8.7pt; }.section-title { margin: 7px 0 0; font-weight: 700; }.grid { display: grid; border: 1px solid #222; border-bottom: 0; }.grid div { min-height: 28px; padding: 4px; border-right: 1px solid #222; border-bottom: 1px solid #222; }.grid div:last-child { border-right: 0; }.grid b { display: block; margin-bottom: 2px; font-size: 7.4pt; }.owner-one { grid-template-columns: 2fr 1fr; }.owner-two { grid-template-columns: 1.5fr .85fr .9fr; }.owner-three { grid-template-columns: 1fr; }.owner-four { grid-template-columns: 1.12fr 1.08fr .45fr .75fr .9fr; }.vehicle-one { grid-template-columns: .75fr 1.7fr .6fr .6fr; }.vehicle-two { grid-template-columns: 2fr .9fr; }.request { margin: 8px 0 4px; font-size: 9.2pt; }.choice { margin: 7px 0; font-size: 10pt; font-weight: 700; line-height: 1.75; }.motives { min-height: 49px; margin-top: 0; padding: 5px; border: 1px solid #222; white-space: pre-wrap; }.legal { margin: 6px 0 10px; font-weight: 700; }.place-date { margin: 12px 0 23px; text-align: center; }.signature { width: 80mm; margin: 0 auto 11px; border-top: 1px solid #222; padding-top: 3px; text-align: center; font-weight: 700; }.docs { border-top: 2px solid #111; padding-top: 4px; font-size: 6.8pt; line-height: 1.22; }.docs strong { font-size: 7.3pt; }.docs ol { margin: 3px 0 0; padding-left: 16px; }.print-hint { position: fixed; z-index: 10; top: 18px; right: 18px; border: 0; background: #b42313; color: #fff; padding: 12px 16px; font-weight: 700; cursor: pointer; }@media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body><button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button><article class="document">
        <img class="logo-symbol" src="${logoUrl}" alt="MEGA Despachante"><h1 class="heading">REQUERIMENTO 2ª VIA DE CRV / CRLV</h1><p class="subtitle">(Anexo Único - Portaria nº 241/2017 - GP/DO)</p><p class="to">Ilmo(a) Sr(a),<br>Gerente de Veículos / Atendimento aos Despachantes / Gerência de Atendimento Regional / Unidade VAPT VUPT<br>Ciretran de <strong>${valueOf(data, 'ciretran') || '____________________________________________'}</strong></p>
        <p class="section-title">1 - Dados do(a) proprietário(a) do veículo:</p><section class="grid owner-one"><div><b>Nome / Razão Social:</b>${valueOf(data, 'proprietario')}</div><div><b>Naturalidade:</b>${valueOf(data, 'naturalidade')}</div></section><section class="grid owner-two"><div><b>CPF / CNPJ:</b>${valueOf(data, 'cpfCnpj')}</div><div><b>RG:</b>${valueOf(data, 'identidade')}</div><div><b>Órgão Expedidor:</b>${valueOf(data, 'orgao')}</div></section><section class="grid owner-three"><div><b>Rua, Avenida, etc:</b>${valueOf(data, 'endereco')}</div></section><section class="grid owner-four"><div><b>Bairro / Setor:</b>${valueOf(data, 'bairro')}</div><div><b>Município:</b>${valueOf(data, 'cidade')}</div><div><b>UF:</b>${valueOf(data, 'estado')}</div><div><b>CEP:</b>${valueOf(data, 'cep')}</div><div><b>Telefone:</b>${valueOf(data, 'telefone')}</div></section>
        <p class="section-title">2 - Dados do Veículo:</p><section class="grid vehicle-one"><div><b>Placa:</b>${valueOf(data, 'placa')}</div><div><b>Chassi:</b>${valueOf(data, 'chassi')}</div><div><b>Ano Fabricação:</b>${valueOf(data, 'anoFabricacao')}</div><div><b>Ano Modelo:</b>${valueOf(data, 'anoModelo')}</div></section><section class="grid vehicle-two"><div><b>Marca / Modelo:</b>${valueOf(data, 'marcaModelo')}</div><div><b>Cor:</b>${valueOf(data, 'cor')}</div></section>
        <p class="request">Vem, respeitosamente à presença de V. Sa., solicitar a expedição da 2ª (segunda) via do:</p><div class="choice">${documentChoice.includes('CRV –') ? '☒' : '☐'} CRV - Certificado de Registro de Veículo<br>${documentChoice.includes('CRLV –') ? '☒' : '☐'} CRLV - Certificado de Registro e Licenciamento de Veículo</div><p class="request">do citado veículo, pela(s) seguinte(s) razão(ões):</p><p class="section-title">3 - Motivos da Solicitação:</p><div class="motives">${valueOf(data, 'motivos')}</div><p class="legal">Responsabilizo-me, sob as penas da Lei Civil e Criminal, pela presente requisição.</p><p>Nestes termos, pede deferimento.</p><p class="place-date">${valueOf(data, 'cidadeAssinatura')}, ${formattedDate(data.get('dataAssinatura'))}.</p><div class="signature">${valueOf(data, 'proprietario')}<br>Requerente</div>
        <section class="docs"><strong>Documentação exigida:</strong><br><strong>1 - Segunda Via de CRV / CRLV:</strong><ol><li>Fazer vistoria do veículo;</li><li>Cópia da Carteira de Identidade e CPF ou CNH válida do proprietário, juntamente com os originais para conferência;</li><li>Comprovante de endereço - cópia e original;</li><li>Reconhecer firma da assinatura do requerente/representante legal, por autenticidade.</li></ol><p><strong>OBS:</strong> Em casos de procuração, seguir ainda as orientações para serviços com procuração.</p></section>
      </article></body></html>`);
    preview.document.close();
  });
}
