const { google } = require('googleapis');

/**
 * Retorna todos os Labels (Setores) da conta autenticada.
 *
 * @param {OAuth2Client} auth
 * @return {Promise<Array>} Lista de labels
 */
async function getLabels(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  return res.data.labels || [];
}

/**
 * Retorna todas as Threads (Chamados) da conta.
 * Gerencia a paginação através do nextPageToken.
 *
 * @param {OAuth2Client} auth
 * @return {Promise<Array>} Lista de threads identificadoras
 */
async function getAllThreads(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  let threads = [];
  let pageToken = undefined;

  do {
    const res = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 500, // Limite máximo da API por página
      pageToken: pageToken,
      // Se quiser filtrar apenas threads que não sejam rascunhos, pode usar q: '-is:draft'
    });

    if (res.data.threads) {
      threads = threads.concat(res.data.threads);
    }
    pageToken = res.data.nextPageToken;

  } while (pageToken);

  return threads;
}

/**
 * Busca os detalhes de uma Thread específica (Mensagens, datas e labels).
 *
 * @param {OAuth2Client} auth
 * @param {string} threadId ID da thread a ser buscada
 * @return {Promise<Object>} Dados detalhados da thread
 */
async function getThreadDetails(auth, threadId) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'metadata', // Puxar apenas metadados necessários otimiza o tempo de resposta
    metadataHeaders: ['Subject', 'From', 'To', 'Date'], // Busca explicitamente headers úteis
  });
  return res.data;
}

module.exports = {
  getLabels,
  getAllThreads,
  getThreadDetails,
};
