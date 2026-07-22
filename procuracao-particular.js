const procuracaoParticularForm = document.getElementById('procuracao-particular-form');

if (procuracaoParticularForm) {
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

  procuracaoParticularForm.elements.dataAssinatura.value = new Date().toISOString().slice(0, 10);
  procuracaoParticularForm.querySelectorAll('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.mask === 'cpf-cnpj') input.value = formatCpfCnpj(input.value);
      if (input.dataset.mask === 'cep') input.value = onlyNumbers(input.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
      if (input.dataset.mask === 'placa') input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (input.dataset.mask === 'telefone') input.value = formatPhone(input.value);
    });
  });

  const setupCepLookup = ({ cep, address, bairro, city, state, feedback }) => {
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
        address.value = result.logradouro || address.value;
        bairro.value = result.bairro || bairro.value;
        city.value = result.localidade || city.value;
        state.value = result.uf || state.value;
        lastCep = postalCode;
        setFeedback('Endereço preenchido. Confira os dados antes de gerar.');
      } catch (error) {
        lastCep = '';
        setFeedback('Não foi possível encontrar este CEP. Preencha o endereço manualmente.', true);
      }
    };
    cep.addEventListener('blur', lookup);
    cep.addEventListener('input', () => {
      if (onlyNumbers(cep.value).length === 8) lookup();
    });
  };

  setupCepLookup({ cep: procuracaoParticularForm.elements.outorganteCep, address: procuracaoParticularForm.elements.outorganteEndereco, bairro: procuracaoParticularForm.elements.outorganteBairro, city: procuracaoParticularForm.elements.outorganteCidade, state: procuracaoParticularForm.elements.outorganteEstado, feedback: document.getElementById('cep-outorgante-feedback') });
  setupCepLookup({ cep: procuracaoParticularForm.elements.procuradorCep, address: procuracaoParticularForm.elements.procuradorEndereco, bairro: procuracaoParticularForm.elements.procuradorBairro, city: procuracaoParticularForm.elements.procuradorCidade, state: procuracaoParticularForm.elements.procuradorEstado, feedback: document.getElementById('cep-procurador-feedback') });

  procuracaoParticularForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!procuracaoParticularForm.reportValidity()) return;
    const data = new FormData(procuracaoParticularForm);
    const detranLogoUrl = new URL('assets/detran-go.png', window.location.href).href;
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }
    preview.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="UTF-8"><title>Procuração Particular</title>
      <style>
        @page { size: A4 portrait; margin: 0; }* { box-sizing: border-box; }body { margin: 0; background: #eee; color: #111; font-family: Arial, sans-serif; }.document { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; padding: 7mm 14mm 6mm; background: #fff; font-size: 8.1pt; line-height: 1.2; }.detran-logo { position: absolute; top: 8mm; left: 14mm; width: 37mm; height: auto; }.header { position: relative; min-height: 19mm; border-bottom: 2px solid #111; }.title { margin: 0 24mm; padding-top: 5mm; text-align: center; font-size: 15pt; }.service-note { position: absolute; top: 0; right: 1mm; width: 20mm; text-align: right; font-size: 7.5pt; }.section-heading { margin: 6px 0 0; font-size: 10pt; font-weight: 700; }.grid { display: grid; border: 1px solid #222; border-bottom: 0; }.grid div { min-height: 26px; padding: 4px; border-right: 1px solid #222; border-bottom: 1px solid #222; }.grid div:last-child { border-right: 0; }.grid b { display: block; margin-bottom: 2px; font-size: 7.1pt; }.full { grid-template-columns: 1fr; }.person-line { grid-template-columns: 1.2fr .9fr .9fr; }.person-address { grid-template-columns: .7fr .9fr .38fr .7fr .88fr; }.contact-line { grid-template-columns: 1.25fr 1fr; }.vehicle-line { grid-template-columns: .55fr 1.5fr .7fr; }.powers { min-height: 103px; padding: 7px; border: 1px solid #222; text-align: justify; font-size: 8.5pt; line-height: 1.35; }.place-date { margin: 12px 0 25px; }.signature { width: 98mm; margin: 0 auto 10px; border-top: 1px solid #222; padding-top: 3px; text-align: center; }.docs { border-top: 2px solid #111; padding-top: 4px; font-size: 6.5pt; line-height: 1.2; }.docs strong { font-size: 7.2pt; }.docs ol { margin: 3px 0; padding-left: 15px; }.footer { border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 6.2pt; }.print-hint { position: fixed; z-index: 10; top: 18px; right: 18px; border: 0; background: #b42313; color: #fff; padding: 12px 16px; font-weight: 700; cursor: pointer; }@media print { body { background: #fff; }.document { width: 210mm; min-height: 297mm; margin: 0; }.print-hint { display: none; } }
      </style></head><body><button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button><article class="document">
        <header class="header"><img class="detran-logo" src="${detranLogoUrl}" alt="DETRAN-GO"><h1 class="title">PROCURAÇÃO PARTICULAR</h1><div class="service-note">(Serviços relacionados a VEÍCULOS)</div></header>
        <h2 class="section-heading">OUTORGANTE:</h2><section class="grid full"><div><b>Nome:</b>${valueOf(data, 'outorganteNome')}</div></section><section class="grid person-line"><div><b>CPF / CNPJ:</b>${valueOf(data, 'outorganteCpfCnpj')}</div><div><b>RG:</b>${valueOf(data, 'outorganteRg')}</div><div><b>Órgão Expedidor:</b>${valueOf(data, 'outorganteOrgao')}</div></section><section class="grid full"><div><b>Rua, Avenida, etc:</b>${valueOf(data, 'outorganteEndereco')}</div></section><section class="grid person-address"><div><b>Bairro/Setor:</b>${valueOf(data, 'outorganteBairro')}</div><div><b>Município:</b>${valueOf(data, 'outorganteCidade')}</div><div><b>UF:</b>${valueOf(data, 'outorganteEstado')}</div><div><b>CEP:</b>${valueOf(data, 'outorganteCep')}</div><div><b>Telefone:</b>${valueOf(data, 'outorganteTelefone')}</div></section><section class="grid contact-line"><div><b>E-mail:</b>${valueOf(data, 'outorganteEmail')}</div><div><b>Telefones:</b>${valueOf(data, 'outorganteTelefone')}</div></section>
        <h2 class="section-heading">OUTORGADO (PROCURADOR):</h2><section class="grid full"><div><b>Nome:</b>${valueOf(data, 'procuradorNome')}</div></section><section class="grid person-line"><div><b>CPF / CNPJ:</b>${valueOf(data, 'procuradorCpfCnpj')}</div><div><b>RG:</b>${valueOf(data, 'procuradorRg')}</div><div><b>Órgão Expedidor:</b>${valueOf(data, 'procuradorOrgao')}</div></section><section class="grid full"><div><b>Rua, Avenida, etc:</b>${valueOf(data, 'procuradorEndereco')}</div></section><section class="grid person-address"><div><b>Bairro/Setor:</b>${valueOf(data, 'procuradorBairro')}</div><div><b>Município:</b>${valueOf(data, 'procuradorCidade')}</div><div><b>UF:</b>${valueOf(data, 'procuradorEstado')}</div><div><b>CEP:</b>${valueOf(data, 'procuradorCep')}</div><div><b>Telefone:</b>${valueOf(data, 'procuradorTelefone')}</div></section><section class="grid contact-line"><div><b>E-mail:</b>${valueOf(data, 'procuradorEmail')}</div><div><b>Telefones:</b>${valueOf(data, 'procuradorTelefone')}</div></section>
        <h2 class="section-heading">DADOS DO VEÍCULO:</h2><section class="grid vehicle-line"><div><b>Placa:</b>${valueOf(data, 'placa')}</div><div><b>Chassi:</b>${valueOf(data, 'chassi')}</div><div><b>Ano de Fabricação:</b>${valueOf(data, 'anoFabricacao')}</div></section>
        <h2 class="section-heading">PODERES:</h2><section class="powers">Com poderes de representação junto ao Detran/GO, outorgando-lhe(s) amplos e gerais poderes para que possam assim realizar todos os atos que forem necessários ao bom e fiel cumprimento deste mandato, inclusive: comprar; vender; ceder; realizar transferência de propriedade; vistoria; transferência de município e/ou UF; primeiro registro; inclusão de veículo; 2ª (segunda) via CRV; 2ª (segunda) via de CRLV; cópia de CRLV; licenciamento anual; alteração de endereço; alteração de características; remarcação de chassi; gravação de motor; alteração de restrição; inclusão de gravame; impedimento de licenciamento; cancelamento do impedimento de licenciamento; mudança de categoria; correção de erros; requerer serviço de comunicado de venda veicular; requerer parcelamento de multas; podendo, para tanto, assinar, requerer, desistir e receber documentos.</section>
        <p class="place-date">${valueOf(data, 'cidadeAssinatura')}, ${formattedDate(data.get('dataAssinatura'))}.</p><div class="signature">Assinatura do(a) Outorgante</div>
        <section class="docs"><strong>Documentação exigida:</strong><br><strong>1 - Toda vez que utilizar procuração:</strong><ol><li>Apresentar original e cópia da procuração;</li><li>Apresentar cópia autenticada em cartório dos documentos pessoais (RG, CPF e comprovante de endereço) do proprietário (outorgante), exceto para alguns tipos de serviço;</li><li>Apresentar original e cópia dos documentos pessoais (RG e CPF) do procurador (outorgado);</li><li>Reconhecer a firma do(s) outorgante(s) em cartório, na modalidade "por verdadeira", "autêntica" ou "aposta na presença do tabelião";</li><li>Se o reconhecimento de firma for de outro município, fazer sinal público em cartório da cidade onde será realizado o serviço.</li></ol><p><strong>OBS:</strong> O Outorgado/Procurador deverá ainda atender a todos os requisitos específicos de cada serviço a ser realizado.</p><p><strong>OBS: COMPROVANTES DE ENDEREÇO ACEITOS PELO DETRAN-GO:</strong> vide orientações do DETRAN-GO.</p></section><footer class="footer">Departamento Estadual de Trânsito de Goiás - www.detran.go.gov.br<br>Av. Atílio Corrêa Lima, s/n, Cidade Jardim - CEP 74.425-091 - Goiânia/GO<br>Grande Goiânia (62-154) - Outras localidades (62-3269-8800)</footer>
      </article></body></html>`);
    preview.document.close();
  });
}
