'use strict';
/*
 * Erros HTTP e tradução dos erros do banco em respostas claras.
 * Regra: o cliente recebe só uma mensagem amigável; o detalhe técnico
 * vai para o log (Fluxo de log do App Service), nunca para a resposta.
 */

class HttpErro extends Error {
  constructor(status, mensagem, extras = {}) {
    super(mensagem);
    this.status = status;
    this.extras = extras;
  }
}

const MENSAGEM_503 = 'Banco de dados indisponível no momento. Tente novamente em instantes.';

// Erros do Azure SQL que significam "o banco está fora do ar agora; tente de novo".
// 40613 = banco indisponível (ex.: acordando da pausa automática da oferta gratuita).
const NUMEROS_TRANSITORIOS = new Set([
  4060, 40197, 40501, 40613, 40143, 40540, 49918, 49919, 49920, 10928, 10929,
]);
const CODIGOS_DE_CONEXAO = new Set([
  'ENOCONFIG', 'ELOGIN', 'ETIMEOUT', 'ESOCKET', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP',
]);

/** Converte um erro do driver mssql em HttpErro, ou devolve null se não for erro conhecido. */
function traduzirErroDoBanco(err) {
  if (!err) return null;
  if (err.name === 'ConnectionError' || CODIGOS_DE_CONEXAO.has(err.code) || NUMEROS_TRANSITORIOS.has(err.number)) {
    return new HttpErro(503, MENSAGEM_503);
  }
  // Restrições do banco: a API valida antes, então chegar aqui é a "última linha de defesa".
  if (err.number === 547) return new HttpErro(400, 'Dados recusados pelas regras do banco.');
  if (err.number === 2627 || err.number === 2601) return new HttpErro(409, 'Registro duplicado.');
  if (err.number === 2628 || err.number === 8152) return new HttpErro(400, 'Texto maior que o permitido.');
  return null;
}

/** Resumo de uma linha para o log, sem string de conexão nem senha. */
function resumirErro(err) {
  const partes = [err?.name, err?.code, err?.number].filter((x) => x !== undefined && x !== null);
  return `${partes.join(' ')}: ${err?.message ?? err}`;
}

const MENSAGENS_DO_CORPO = {
  'entity.parse.failed': 'O corpo da requisição não é um JSON válido.',
  'entity.too.large': 'O corpo da requisição é grande demais.',
};

/** Middleware final do Express: transforma qualquer erro em JSON { erro: "..." }. */
// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpErro) {
    return res.status(err.status).json({ erro: err.message, ...err.extras });
  }

  // Erros do leitor de JSON do Express (JSON malformado, corpo grande demais...).
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ erro: MENSAGENS_DO_CORPO[err.type] ?? 'Requisição inválida.' });
  }

  const traduzido = traduzirErroDoBanco(err);
  if (traduzido) {
    console.error(`[erro] ${req.method} ${req.originalUrl} -> ${traduzido.status} | ${resumirErro(err)}`);
    if (traduzido.status === 503) res.set('Retry-After', '30');
    return res.status(traduzido.status).json({ erro: traduzido.message });
  }

  console.error(`[erro] ${req.method} ${req.originalUrl} -> 500 |`, err);
  return res.status(500).json({ erro: 'Erro interno do servidor. Tente novamente; se persistir, avise a equipe.' });
}

module.exports = { HttpErro, MENSAGEM_503, traduzirErroDoBanco, resumirErro, tratarErros };
