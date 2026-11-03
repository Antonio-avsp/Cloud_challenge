'use strict';
/*
 * Conexão com o Azure SQL Database.
 * A string de conexão vem SÓ da variável de ambiente DATABASE_URL
 * (Configurações do App Service na nuvem; arquivo .env no computador).
 * Formato: o mesmo que o portal mostra em "Cadeias de conexão > ADO.NET".
 */
const sql = require('mssql');

let poolPromise = null;

function erroDeConfiguracao(mensagem) {
  const erro = new Error(mensagem);
  erro.code = 'ENOCONFIG';
  return erro;
}

function lerConfiguracao() {
  const url = process.env.DATABASE_URL;
  if (!url) throw erroDeConfiguracao('DATABASE_URL não definida (configure no App Service ou no arquivo .env).');

  const config = sql.ConnectionPool.parseConnectionString(url);
  if (!config.server) throw erroDeConfiguracao('DATABASE_URL inválida: não encontrei o servidor (Server=...).');

  config.options = { encrypt: true, ...config.options, appName: 'g01-mural-da-coordenacao' };
  config.pool = { max: 5, min: 0, idleTimeoutMillis: 30_000 };
  config.connectionTimeout ??= 30_000;
  config.requestTimeout ??= 15_000;
  return config;
}

/**
 * Devolve o pool de conexões (criado na primeira chamada).
 * Se a conexão falhar (firewall, senha, banco pausado), o erro sobe para a
 * rota (que responde 503) e a PRÓXIMA requisição tenta conectar de novo:
 * o app não cai nem precisa ser reiniciado quando o banco volta.
 */
function obterPool() {
  if (!poolPromise) {
    let pool;
    try {
      pool = new sql.ConnectionPool(lerConfiguracao());
    } catch (err) {
      return Promise.reject(err);
    }
    pool.on('error', (err) => console.error('[banco] erro no pool:', err.message));
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      pool.close().catch(() => {});
      throw err;
    });
  }
  return poolPromise;
}

async function fechar() {
  const atual = poolPromise;
  poolPromise = null;
  if (!atual) return;
  try {
    await (await atual).close();
  } catch {
    // já estava fechado ou nunca conectou
  }
}

/** "servidor/banco" para o log de inicialização (sem usuário nem senha). */
function descreverDestino() {
  try {
    const { server, database } = lerConfiguracao();
    return `${server}/${database ?? '(banco padrão)'}`;
  } catch (err) {
    return `NÃO CONFIGURADO (${err.message})`;
  }
}

module.exports = { sql, obterPool, fechar, descreverDestino };
