const fs = require('fs').promises;
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

/**
 * Salva os resultados agregados em um arquivo JSON.
 *
 * @param {Object} data Objeto contendo os KPIs
 * @param {string} filename Nome do arquivo de saída (default: results.json)
 */
async function exportResultsToJson(data, filename = 'results.json') {
  const filePath = path.join(process.cwd(), filename);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`[SUCESSO] Relatório JSON gerado em: ${filePath}`);
  } catch (error) {
    console.error(`[ERRO] Falha ao exportar JSON:`, error);
  }
}

/**
 * Salva a lista detalhada de chamados em um arquivo CSV.
 *
 * @param {Array} threadsList Lista de objetos formatados de threads
 * @param {string} filename Nome do arquivo de saída (default: chamados.csv)
 */
async function exportThreadsToCsv(threadsList, filename = 'chamados.csv') {
  const filePath = path.join(process.cwd(), filename);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'Id da Thread' },
      { id: 'remetente', title: 'Remetente (Usuário)' },
      { id: 'setor', title: 'Setor do Chamado' },
      { id: 'resolvido', title: 'Chamado Fechado' },
      { id: 'emAberto', title: 'Chamado em Aberto' },
      { id: 'emAndamento', title: 'Chamado em Andamento' },
      { id: 'dataAbertura', title: 'Data de Abertura' },
      { id: 'dataResposta', title: 'Primeira Resposta (Atendimento)' },
      { id: 'tempoRespostaHoras', title: 'Tempo de Resposta em Horas' }
    ]
  });

  try {
    // Transforma array para lidar com arrays aninhados se houver e formata nulos
    const records = threadsList.map(t => ({
      id: t.id,
      remetente: t.remetente || 'N/A',
      setor: t.setor,
      resolvido: t.resolvido ? 'Sim' : 'Não',
      emAberto: t.emAberto ? 'Sim' : 'Não',
      emAndamento: t.emAndamento ? 'Sim' : 'Não',
      dataAbertura: t.dataAbertura || 'N/A',
      dataResposta: t.dataResposta || 'N/A',
      tempoRespostaHoras: t.tempoRespostaHoras !== null ? t.tempoRespostaHoras : 'N/A'
    }));

    await csvWriter.writeRecords(records);
    console.log(`[SUCESSO] Relatório CSV gerado em: ${filePath}`);
  } catch (error) {
    console.error(`[ERRO] Falha ao exportar CSV:`, error);
  }
}

module.exports = {
  exportResultsToJson,
  exportThreadsToCsv
};
