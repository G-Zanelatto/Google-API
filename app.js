const { authorize } = require('./auth');
const { getLabels, getAllThreads, getThreadDetails } = require('./gmailService');
const {
  identificarSetor,
  verificarStatus,
  extrairRemetente,
  processarTemposMensagem,
  calcularIndicadores,
} = require('./analytics');
const { exportResultsToJson, exportThreadsToCsv } = require('./exporter');

async function main() {
  try {
    console.log('Iniciando script de Indicadores de Suporte do Gmail...');
    
    // 1. Autenticação (Abre navegador se não houver token)
    console.log('Autenticando...');
    const auth = await authorize();
    console.log('Autenticação concluída com sucesso!');
    
    // 2. Busca todas as Labels do usuário para mapear os setores
    console.log('Buscando labels (setores)...');
    const systemLabels = await getLabels(auth);
    
    // 3. Busca todas as Threads (chamados)
    console.log('Buscando todas as threads (pode demorar dependendo do volume)...');
    const rawThreads = await getAllThreads(auth);
    console.log(`Foram encontradas ${rawThreads.length} threads no total.`);

    // 4. Detalhar e processar cada Thread
    console.log('Processando detalhes e regras de negócio de cada thread...');
    const threadsProcessadas = [];
    
    // Limitando a quantidade processada em paralelo para evitar bater no limite de requisições da API do Google (Rate Limit)
    // Se o volume de e-mails for gigantesco, você pode futuramente implementar p-limit, por enquanto usaremos um laço sequencial
    let count = 0;
    for (const thread of rawThreads) {
      count++;
      if (count % 50 === 0) console.log(`Processadas ${count}/${rawThreads.length}...`);
      
      const details = await getThreadDetails(auth, thread.id);
      
      // O formato retornado do 'metadata' coloca as labels direto na thread, e as mensagens no array messages
      // Extrair todas as labelIds unicas dessa thread
      const threadLabelIds = details.messages 
        ? [...new Set(details.messages.flatMap(m => m.labelIds || []))]
        : [];

      const setor = identificarSetor(threadLabelIds, systemLabels);
      const statusObj = verificarStatus(threadLabelIds, systemLabels);
      const remetente = extrairRemetente(details.messages);
      const tempos = processarTemposMensagem(details.messages);

      threadsProcessadas.push({
        id: thread.id,
        remetente,
        setor,
        resolvido: statusObj.resolvido,
        emAberto: statusObj.emAberto,
        emAndamento: statusObj.emAndamento,
        dataAbertura: tempos.dataAbertura,
        dataResposta: tempos.dataResposta,
        tempoRespostaHoras: tempos.tempoRespostaHoras
      });
    }

    // 5. Calcular KPIs
    console.log('Calculando indicadores...');
    const indicadores = calcularIndicadores(threadsProcessadas);

    // 6. Exportar Resultados
    console.log('Exportando arquivos...');
    await exportResultsToJson(indicadores, 'results.json');
    await exportThreadsToCsv(threadsProcessadas, 'chamados.csv');

    console.log('Script finalizado com sucesso!');

  } catch (error) {
    console.error('Erro na execução do script principal:', error);
  }
}

main();
