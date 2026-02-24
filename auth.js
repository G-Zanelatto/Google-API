const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// Scopes requeridos pela aplicação (Apenas leitura do Gmail)
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Caminho para os arquivos de token e credenciais
// O token.json armazena o access token e o refresh token do usuário, sendo criado
// automaticamente na primeira vez que o fluxo de autorização for completado.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Lê o arquivo token.json criado anteriormente.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializa os dados da conta no arquivo token.json para execuções futuras
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Carrega a aplicação, solicitando autorização se o token não existir.
 *
 * @return {Promise<OAuth2Client>}
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  
  // Se não existir o token, abre o navegador para o usuário autorizar
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  
  // Salva o token gerado para não precisar autenticar novamente na próxima varredura
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

module.exports = {
  authorize,
};
