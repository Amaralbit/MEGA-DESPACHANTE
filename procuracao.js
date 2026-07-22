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

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const valueOf = (data, key) => escapeHtml(data.get(key));
  const formattedDate = (value) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  procuracaoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!procuracaoForm.reportValidity()) return;

    const data = new FormData(procuracaoForm);
    const outorgante = valueOf(data, 'outorgante');
    const date = formattedDate(data.get('dataAssinatura'));
    const city = valueOf(data, 'cidadeAssinatura');
    const address = `${valueOf(data, 'endereco')}, ${valueOf(data, 'numero')}${data.get('complemento') ? ` - ${valueOf(data, 'complemento')}` : ''}, ${valueOf(data, 'bairro')}, ${valueOf(data, 'cidade')}/${valueOf(data, 'estado')} - CEP ${valueOf(data, 'cep')}`;
    const vehicle = `${valueOf(data, 'marca')} ${valueOf(data, 'modelo')}, ano fabricação/modelo ${valueOf(data, 'anoFabricacao')}/${valueOf(data, 'anoModelo')}, cor ${valueOf(data, 'cor')}, placa ${valueOf(data, 'placa')}, chassi ${valueOf(data, 'chassi')}`;
    const logoUrl = new URL('assets/logo-mega-chroma.png', window.location.href).href;
    const preview = window.open('', '_blank', 'width=920,height=760');
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
        .logo { color: #b42313; font-weight: 800; letter-spacing: 1px; font-size: 10pt; margin-bottom: 10px; }
        .logo-symbol { position: absolute; top: 10mm; right: 15mm; width: 18mm; height: 18mm; object-fit: contain; }
        .title { text-align: center; font-size: 14pt; font-weight: 700; margin: 2px 0 16px; text-transform: uppercase; }
        .text { text-align: justify; }.text p { margin: 0 0 9px; }
        .signature { margin-top: 24px; text-align: center; }.signature p { margin: 0; }
        .signature-line { width: 310px; border-top: 1px solid #222; margin: 25px auto 5px; }
        .declaration { width: 140mm; border: 1px solid #444; margin: 23px auto 0; padding: 10px 16px 8px; text-align: center; font-size: 8.4pt; line-height: 1.25; }
        .declaration h2 { font-size: 9.5pt; margin: 0 0 8px; }.declaration p { margin: 0; }.declaration strong { display: block; margin-top: 2px; }
        .declaration .dispatch-signature { width: 270px; border-top: 1px solid #222; margin: 32px auto 4px; }.declaration .dispatch-name { font-size: 9.5pt; font-weight: 700; }
        .details { margin-top: 14px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8pt; color: #444; }.details strong { color: #111; }
        .print-hint { position: fixed; z-index: 10; right: 18px; top: 18px; background: #b42313; color: #fff; border: 0; padding: 12px 16px; cursor: pointer; font-weight: 700; }
        @media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body>
      <button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button>
      <article class="document">
        <img class="logo-symbol" src="${logoUrl}" alt="MEGA Despachante">
        <div class="logo">MEGA DESPACHANTE</div><h1 class="title">Procuração para veículo</h1>
        <div class="text">
          <p><strong>OUTORGANTE:</strong> ${outorgante}, inscrito(a) no CPF/CNPJ sob nº ${valueOf(data, 'cpfCnpj')}, portador(a) do documento de identidade nº ${valueOf(data, 'identidade')} - ${valueOf(data, 'orgao')}, residente e domiciliado(a) em ${address}.</p>
          <p>Pelo presente instrumento particular de procuração, nomeio e constituo como meu bastante procurador <strong>${valueOf(data, 'despachante')}</strong>, código ${valueOf(data, 'codigoDespachante')}, com endereço em ${valueOf(data, 'enderecoDespachante')}, ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}, a quem confiro poderes para me representar perante o DETRAN/GO e demais órgãos públicos competentes, praticando os atos necessários relacionados aos serviços de despachante e regularização documental do veículo abaixo identificado.</p>
          <p><strong>VEÍCULO:</strong> ${vehicle}.</p><p><strong>FINALIDADE:</strong> podendo para tanto assinar o de acordo como adquirente do ATPV, receber e entregar CNH apreendida na comissão de apreensão e pontuação deste órgão. Podendo ainda, requerer e assinar o que necessário for, liberar veículos apreendidos, fazer pagamentos, receber e dar quitações, alegar, concordar, discordar, prestar declarações e informações, desistir, enfim, praticar quaisquer outros atos que se fizerem necessários para o fiel cumprimento deste mandato, bem como repassar informações e dados entre os órgãos e parceiros acima nominados sobre os serviços solicitados e/ou realizados, não havendo proibições de qualquer natureza em relação à Lei Geral de Proteção de Dados (LGPD), o que desde já fica dado por firme e valioso, e dando poderes também para <strong>${valueOf(data, 'servico')}</strong>.</p>
          <p>Esta procuração é outorgada para os fins acima descritos, responsabilizando-me pela veracidade das informações prestadas.</p>
        </div>
        <div class="signature"><p>${city}, ${date}.</p><div class="signature-line"></div><strong>${outorgante}</strong><br>Outorgante</div>
        <section class="declaration"><h2>DECLARAÇÃO</h2><p>Declaramos, sob a pena da lei, que a assinatura aposta na Procuração é de próprio punho do outorgante, feita em nossa presença, onde desde já assumimos a responsabilidade civil e criminal.</p><strong>${city}, ${date}</strong><div class="dispatch-signature"></div><div class="dispatch-name">DESPACHANTE MEGA</div></section>
        <div class="details"><strong>Dados da MEGA Despachante:</strong> Código ${valueOf(data, 'codigoDespachante')} · ${valueOf(data, 'enderecoDespachante')} · ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}</div>
      </article></body></html>`);
    preview.document.close();
  });
}
