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
    const address = `${valueOf(data, 'endereco')}, ${valueOf(data, 'numero')}${data.get('complemento') ? ` - ${valueOf(data, 'complemento')}` : ''}, ${valueOf(data, 'bairro')}, ${valueOf(data, 'cidade')}/${valueOf(data, 'estado')} - CEP ${valueOf(data, 'cep')}`;
    const vehicle = `${valueOf(data, 'marca')} ${valueOf(data, 'modelo')}, ano fabricação/modelo ${valueOf(data, 'anoFabricacao')}/${valueOf(data, 'anoModelo')}, cor ${valueOf(data, 'cor')}, placa ${valueOf(data, 'placa')}, chassi ${valueOf(data, 'chassi')}`;
    const preview = window.open('', '_blank', 'width=920,height=760');
    if (!preview) {
      window.alert('Não foi possível abrir a visualização. Libere pop-ups para gerar o PDF.');
      return;
    }

    preview.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Procuração para veículo</title><style>body{font-family:Arial,sans-serif;color:#161616;margin:0;background:#eee}.document{box-sizing:border-box;width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:20mm 19mm;font-size:12pt;line-height:1.65}.logo{color:#b42313;font-weight:800;letter-spacing:1px;font-size:13px;margin-bottom:24px}.title{text-align:center;font-size:17px;font-weight:700;margin:6px 0 30px;text-transform:uppercase}.text{text-align:justify}.text p{margin:0 0 17px}.signature{margin-top:58px;text-align:center}.signature-line{width:330px;border-top:1px solid #222;margin:0 auto 7px}.declaration{width:140mm;box-sizing:border-box;border:1px solid #444;margin:42px auto 0;padding:14px 18px 10px;text-align:center;font-size:9.5pt;line-height:1.34}.declaration h2{font-size:10.5pt;margin:0 0 14px}.declaration p{margin:0}.declaration strong{display:block;margin-top:2px}.declaration .dispatch-signature{width:270px;border-top:1px solid #222;margin:60px auto 5px}.declaration .dispatch-name{font-size:10.5pt;font-weight:700}.details{margin-top:28px;border-top:1px solid #ccc;padding-top:13px;font-size:9.5pt;color:#444}.details strong{color:#111}@media print{body{background:#fff}.document{margin:0;width:auto;min-height:0;box-shadow:none}.print-hint{display:none}}.print-hint{position:fixed;right:18px;top:18px;background:#b42313;color:#fff;border:0;padding:12px 16px;cursor:pointer;font-weight:700}</style></head><body><button class="print-hint" onclick="window.print()">Imprimir / Salvar PDF</button><article class="document"><div class="logo">MEGA DESPACHANTE</div><h1 class="title">Procuração para veículo</h1><div class="text"><p><strong>OUTORGANTE:</strong> ${outorgante}, inscrito(a) no CPF/CNPJ sob nº ${valueOf(data, 'cpfCnpj')}, portador(a) do documento de identidade nº ${valueOf(data, 'identidade')} - ${valueOf(data, 'orgao')}, residente e domiciliado(a) em ${address}.</p><p>Pelo presente instrumento particular de procuração, nomeio e constituo como meu bastante procurador <strong>${valueOf(data, 'despachante')}</strong>, código ${valueOf(data, 'codigoDespachante')}, com endereço em ${valueOf(data, 'enderecoDespachante')}, ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}, a quem confiro poderes para me representar perante o DETRAN/GO e demais órgãos públicos competentes, praticando os atos necessários relacionados aos serviços de despachante e regularização documental do veículo abaixo identificado.</p><p><strong>VEÍCULO:</strong> ${vehicle}.</p><p><strong>FINALIDADE:</strong> ${valueOf(data, 'servico')}.</p><p>Esta procuração é outorgada para os fins acima descritos, responsabilizando-me pela veracidade das informações prestadas.</p></div><div class="signature"><p>${valueOf(data, 'cidadeAssinatura')}, ${formattedDate(data.get('dataAssinatura'))}.</p><br><br><div class="signature-line"></div><strong>${outorgante}</strong><br>Outorgante</div><section class="declaration"><h2>DECLARAÇÃO</h2><p>Declaramos, sob a pena da lei, que a assinatura aposta na Procuração é de próprio punho do outorgante, feita em nossa presença, onde desde já assumimos a responsabilidade civil e criminal.</p><strong>${valueOf(data, 'cidadeAssinatura')}, ${formattedDate(data.get('dataAssinatura'))}</strong><div class="dispatch-signature"></div><div class="dispatch-name">DESPACHANTE MEGA</div></section><div class="details"><strong>Dados da MEGA Despachante:</strong> Código ${valueOf(data, 'codigoDespachante')} · ${valueOf(data, 'enderecoDespachante')} · ${valueOf(data, 'cidadeDespachante')}/${valueOf(data, 'estadoDespachante')}</div></article></body></html>`);
    preview.document.close();
  });
}
