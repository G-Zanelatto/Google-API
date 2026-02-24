// analytics.js
// Módulo de regras de negócio e cálculo de indicadores

// Labels de sistema a serem ignoradas na hora de computar setor
const IGNORED_LABELS = ['INBOX', 'SENT', 'IMPORTANT', 'CATEGORY_PERSONAL', 'UNREAD', 'STARRED', 'CHAT', 'TRASH', 'DRAFT', 'SPAM', 'CATEGORY_FORUMS', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL'];

/**
 * Filtra e retorna o nome do setor a partir das labels da thread, ignorando as padrões
 *
 * @param {Array} threadLabelIds IDs das labels da thread
 * @param {Array} systemLabels Mapa completo das labels da conta  ({id, name})
 * @return {string} Nome do setor ou 'Indefinido'
 */
function identificarSetor(threadLabelIds, systemLabels) {
  if (!threadLabelIds) return 'Indefinido';
  
  for (const labelId of threadLabelIds) {
    if (!IGNORED_LABELS.includes(labelId)) {
      const labelData = systemLabels.find(l => l.id === labelId);
      // Pega qualquer label que comece com "Setor" como sendo a departamental
      if (labelData && labelData.name.toUpperCase().startsWith('SETOR')) {
        // Opcional: Remover a palavra "Setor " da frente se quiser o relatorio mais limpo (ex: "Setor Financeiro" vira "Financeiro")
        return labelData.name.replace(/^Setor\s+/i, ''); 
      }
    }
  }
  return 'Indefinido';
}

/**
 * Verifica se a thread está marcada como resolvida
 *
 * @param {Array} threadLabelIds
 * @param {Array} systemLabels
 * @return {boolean}
 */
function verificarStatus(threadLabelIds, systemLabels) {
  let resolvido = false;
  let emAberto = false;
  let emAndamento = false;

  if (threadLabelIds) {
    for (const labelId of threadLabelIds) {
      const labelData = systemLabels.find(l => l.id === labelId);
      if (labelData) {
        const name = labelData.name.toUpperCase();
        if (name === 'CHAMADOS FECHADOS') resolvido = true;
        if (name === 'CHAMADOS EM ABERTO') emAberto = true;
        if (name === 'CHAMADOS EM ANDAMENTO') emAndamento = true;
      }
    }
  }
  return { resolvido, emAberto, emAndamento };
}

/**
 * Extrai o remetente original a partir do cabeçalho da primeira mensagem do chamado.
 *
 * @param {Array} messages
 * @return {string} E-mail ou Nome+Email do remetente
 */
function extrairRemetente(messages) {
  if (!messages || messages.length === 0) return 'Desconhecido';
  
  const primeiraMensagem = messages[0];
  if (primeiraMensagem.payload && primeiraMensagem.payload.headers) {
    const fromHeader = primeiraMensagem.payload.headers.find(h => h.name.toUpperCase() === 'FROM');
    if (fromHeader) {
      return fromHeader.value;
    }
  }
  return 'Desconhecido';
}

/**
 * Processa as mensagens de uma chamada (thread) para extrair métricas de tempo
 *
 * @param {Array} messages
 * @return {Object} Contendo dataAbertura (ISO), dataResposta (ISO|null) e tempoRespostaHoras (Number|null)
 */
function processarTemposMensagem(messages) {
  if (!messages || messages.length === 0) {
    return { dataAbertura: null, dataResposta: null, tempoRespostaHoras: null };
  }

  // As mensagens vêm ordenadas cronologicamente (da mais antiga para a mais nova) na thread
  const primeiraMensagem = messages[0];
  const timestampAbertura = parseInt(primeiraMensagem.internalDate, 10);
  const dataAbertura = new Date(timestampAbertura);

  let dataResposta = null;
  let tempoRespostaHoras = null;

  // Busca a primeira mensagem que tenha a label SENT (resposta do suporte)
  const primeiraResposta = messages.find(msg => msg.labelIds && msg.labelIds.includes('SENT'));

  if (primeiraResposta) {
    const timestampResposta = parseInt(primeiraResposta.internalDate, 10);
    dataResposta = new Date(timestampResposta);
    
    // Calcula a diferença em milissegundos e converte para horas
    const diffMs = timestampResposta - timestampAbertura;
    tempoRespostaHoras = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
  }

  return {
    dataAbertura: dataAbertura.toISOString(),
    dataResposta: dataResposta ? dataResposta.toISOString() : null,
    tempoRespostaHoras,
  };
}

/**
 * Função principal para calcular todos os indicadores requeridos pelo escopo
 *
 * @param {Array} threadsList Lista detalhada de cada thread (já processada)
 * @return {Object} Objeto contendo os KPIs agregados
 */
function calcularIndicadores(threadsList) {
  const kpis = {
    totalChamados: threadsList.length,
    chamadosPorSetor: {},
    chamadosPorRemetente: {},
    chamadosPorMes: {},
    mediaTrimestral: {},
    chamadosResolvidosPorMes: {},
    chamadosEmAbertoPorMes: {},
    chamadosEmAndamentoPorMes: {},
    tempoMedioRespostaGlobalHoras: 0
  };

  let somaTempoResposta = 0;
  let qtdComResposta = 0;

  for (const t of threadsList) {
    // 1. Agrupar por Setor
    kpis.chamadosPorSetor[t.setor] = (kpis.chamadosPorSetor[t.setor] || 0) + 1;

    // 2. Agrupar por Remetente
    if (t.remetente) {
      // Opcional: tentar limpar um pouco se vier como "Nome <email>" para agrupar só pelo email
      const regexEmail = /<(.+?)>/;
      const match = t.remetente.match(regexEmail);
      const chaveRemetente = match ? match[1] : t.remetente;
      kpis.chamadosPorRemetente[chaveRemetente] = (kpis.chamadosPorRemetente[chaveRemetente] || 0) + 1;
    }

    // 3. Agrupar por Mês (YYYY-MM)
    if (t.dataAbertura) {
      const dataIso = t.dataAbertura.substring(0, 7); // Ex: "2023-10"
      kpis.chamadosPorMes[dataIso] = (kpis.chamadosPorMes[dataIso] || 0) + 1;

      // 3. Status agrupados por Mês
      if (t.resolvido) {
        kpis.chamadosResolvidosPorMes[dataIso] = (kpis.chamadosResolvidosPorMes[dataIso] || 0) + 1;
      }
      if (t.emAberto) {
        kpis.chamadosEmAbertoPorMes[dataIso] = (kpis.chamadosEmAbertoPorMes[dataIso] || 0) + 1;
      }
      if (t.emAndamento) {
        kpis.chamadosEmAndamentoPorMes[dataIso] = (kpis.chamadosEmAndamentoPorMes[dataIso] || 0) + 1;
      }

      // 4. Média Trimestral (Agrupando em YYYY-QX)
      const year = t.dataAbertura.substring(0, 4);
      const month = parseInt(t.dataAbertura.substring(5, 7), 10);
      const quarter = Math.ceil(month / 3);
      const trimKey = `${year}-Q${quarter}`;
      
      // Incrementa o contador do trimestre
      if (!kpis.mediaTrimestral[trimKey]) {
        kpis.mediaTrimestral[trimKey] = { total: 0, meses: new Set() };
      }
      kpis.mediaTrimestral[trimKey].total += 1;
      kpis.mediaTrimestral[trimKey].meses.add(dataIso);
    }

    // 5. Soma de tempos para média global
    if (t.tempoRespostaHoras !== null) {
      somaTempoResposta += t.tempoRespostaHoras;
      qtdComResposta += 1;
    }
  }

  // Finaliza o cálculo da média trimestral
  for (const key in kpis.mediaTrimestral) {
    const data = kpis.mediaTrimestral[key];
    // A fórmula pedida: média = total / quantidade de meses do trimestre (1 a 3 dependendo dos dados reais ocorridos ou fixo em 3)
    // Para ser mais preciso com os dados existentes, dividimos pela quantidade de meses ÚNICOS que tiveram tickets naquele trimestre, 
    // ou dividimos fixo por 3 se preferir projetar a média inteira do trimestre. Vamos usar fixo por 3 para uma visão padronizada da média do período.
    const media = parseFloat((data.total / 3).toFixed(2));
    kpis.mediaTrimestral[key] = media;
  }

  // Finaliza o cálculo do tempo médio de resposta
  if (qtdComResposta > 0) {
    kpis.tempoMedioRespostaGlobalHoras = parseFloat((somaTempoResposta / qtdComResposta).toFixed(2));
  }

  return kpis;
}

module.exports = {
  identificarSetor,
  verificarStatus,
  extrairRemetente,
  processarTemposMensagem,
  calcularIndicadores,
};
