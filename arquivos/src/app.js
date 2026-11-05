'use strict';
/*
 * Monta a aplicação Express: segurança, log, tela (public/), /health e API.
 * Fica separado do server.js para os testes criarem o app sem abrir porta fixa.
 */
const path = require('node:path');
const express = require('express');
const { obterPool } = require('./banco');
const { tratarErros, resumirErro, MENSAGEM_503 } = require('./erros');
const { FUSO_HORARIO, hojeEmBrasilia } = require('./datas');

function cabecalhosDeSeguranca(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    // A tela só carrega scripts e estilos do próprio site (nada de script embutido).
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
      "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (req.path === '/health' || req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}

/** Uma linha por requisição no log (aparece no Fluxo de log do App Service). */
function registrarRequisicoes(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
}

function criarApp() {
  const app = express();
  // Muda a cada reinício do processo: é a prova de que a aplicação reiniciou.
  const iniciadoEm = new Date();

  app.disable('x-powered-by');
  app.use(cabecalhosDeSeguranca);
  app.use(registrarRequisicoes);
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Testa a conexão com o banco de verdade (SELECT 1), não só se o app está de pé.
  app.get('/health', async (req, res) => {
    const base = { iniciado_em: iniciadoEm.toISOString(), fuso: FUSO_HORARIO, hoje: hojeEmBrasilia() };
    const inicio = Date.now();
    try {
      const pool = await obterPool();
      await pool.request().query('SELECT 1 AS ok;');
      res.json({ status: 'ok', banco: 'conectado', latencia_banco_ms: Date.now() - inicio, ...base });
    } catch (err) {
      console.error(`[health] banco indisponível | ${resumirErro(err)}`);
      res.status(503).set('Retry-After', '30').json({
        status: 'erro',
        banco: 'indisponivel',
        mensagem: MENSAGEM_503,
        ...base,
      });
    }
  });

  // As rotas /api/tarefas entram na parte 4 (rotas-tarefas.js).
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  app.use((req, res) => res.status(404).json({ erro: 'Página não encontrada.' }));
  app.use(tratarErros);

  return app;
}

module.exports = { criarApp };
