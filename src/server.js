'use strict';
/*
 * Ponto de entrada (npm start). Na Azure, o App Service roda "npm start"
 * e informa a porta na variável PORT.
 */
const fs = require('node:fs');
const path = require('node:path');

// No computador, as variáveis vêm do arquivo .env (que NUNCA vai para o Git).
// Na Azure não existe .env: elas vêm de Configurações > Variáveis de ambiente.
// Variáveis já definidas no ambiente têm prioridade sobre o arquivo.
const arquivoEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const banco = require('./banco');
const { criarApp } = require('./app');
const { resumirErro } = require('./erros');

const PORTA = Number(process.env.PORT) || 3000;
const servidor = criarApp().listen(PORTA, () => {
  console.log(`[mural] ouvindo na porta ${PORTA} | banco: ${banco.descreverDestino()}`);
  // Já tenta conectar ao subir (e "acorda" o Azure SQL se estiver pausado).
  // Se falhar, o app continua de pé: /health responde 503 e tenta de novo depois.
  banco
    .obterPool()
    .then(() => console.log('[banco] conectado'))
    .catch((err) => console.error(`[banco] ainda indisponível | ${resumirErro(err)}`));
});

// O App Service manda SIGTERM ao reiniciar: fecha o servidor e as conexões com calma.
function encerrar(sinal) {
  console.log(`[mural] ${sinal} recebido, encerrando...`);
  servidor.close(() => banco.fechar().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.once('SIGTERM', () => encerrar('SIGTERM'));
process.once('SIGINT', () => encerrar('SIGINT'));
