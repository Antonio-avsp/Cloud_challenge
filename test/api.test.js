'use strict';
/*
 * Testes de integração: API + banco DE VERDADE (o da DATABASE_URL).
 *   npm test        (roda unidade + integração)
 *
 * Cada execução usa um "responsável" único (ex.: "QA Auto mh3k2x") e, no fim,
 * apaga tudo o que criou. Pode rodar no banco da Azure sem bagunçar os dados.
 * Sem DATABASE_URL, estes testes são pulados (os de unidade continuam rodando).
 */
process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const arquivoEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const semBanco = process.env.DATABASE_URL
  ? false
  : 'defina DATABASE_URL (no .env) para rodar os testes de integração';

describe('API + banco de verdade', { skip: semBanco }, () => {
  const marca = `QA Auto ${Date.now().toString(36)}`; // responsável exclusivo desta execução
  let banco;
  let servidor;
  let base;

  before(async () => {
    banco = require('../src/banco');
    const { criarApp } = require('../src/app');
    servidor = criarApp().listen(0);
    await once(servidor, 'listening');
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  after(async () => {
    if (banco) {
      const pool = await banco.obterPool();
      await pool.request()
        .input('marca', banco.sql.NVarChar(80), marca)
        .query('DELETE FROM dbo.tarefas WHERE responsavel = @marca;');
      await banco.fechar();
    }
    if (servidor) servidor.close();
  });

  async function chamar(metodo, rota, corpo) {
    const resposta = await fetch(base + rota, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
  }

  const criar = (extra = {}) =>
    chamar('POST', '/api/tarefas', { titulo: 'Tarefa de teste automático', responsavel: marca, ...extra });

  /** Consulta direta no banco (sem passar pela API) para conferir o que foi gravado. */
  async function linhasNoBanco(titulo) {
    const pool = await banco.obterPool();
    const { recordset } = await pool.request()
      .input('marca', banco.sql.NVarChar(80), marca)
      .input('titulo', banco.sql.NVarChar(120), titulo)
      .query('SELECT id, titulo, concluida_em FROM dbo.tarefas WHERE responsavel = @marca AND titulo = @titulo;');
    return recordset;
  }

  test('GET /health testa o banco e informa iniciado_em', async () => {
    const r = await chamar('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.corpo.banco, 'conectado');
    assert.ok(!Number.isNaN(Date.parse(r.corpo.iniciado_em)));
    assert.equal(r.corpo.fuso, 'America/Sao_Paulo');
  });

  test('CA1 (negativo): título com 2 caracteres -> 400 com mensagem e nada gravado', async () => {
    const r = await criar({ titulo: 'ab' });
    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /entre 3 e 120 caracteres/);
    assert.equal((await linhasNoBanco('ab')).length, 0);
  });

  test('CA2 (negativo): prazo anterior a hoje -> 400', async () => {
    const hoje = (await chamar('GET', '/health')).corpo.hoje;
    const ontem = new Date(Date.parse(`${hoje}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const r = await criar({ titulo: 'Prazo no passado', prazo: ontem });
    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /anterior a hoje/);
    assert.equal((await linhasNoBanco('Prazo no passado')).length, 0);
  });

  test('RF1: cadastro válido -> 201, prioridade padrão "media", situação pendente', async () => {
    const r = await criar({ titulo: 'Reservar o auditório' });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), `/api/tarefas/${r.corpo.id}`);
    assert.equal(r.corpo.prioridade, 'media');
    assert.equal(r.corpo.situacao, 'pendente');
    assert.equal(r.corpo.concluida_em, null);
    assert.equal((await linhasNoBanco('Reservar o auditório')).length, 1);
  });

  test('CA3 (regra central): concluir -> concluida_em preenchido; concluir de novo -> 409 sem mudar a data', async () => {
    const { corpo: tarefa } = await criar({ titulo: 'Conferir diários de classe' });

    const primeira = await chamar('PATCH', `/api/tarefas/${tarefa.id}/concluir`);
    assert.equal(primeira.status, 200);
    assert.equal(primeira.corpo.situacao, 'concluida');
    const concluidaEm = Date.parse(primeira.corpo.concluida_em);
    assert.ok(Math.abs(Date.now() - concluidaEm) < 5 * 60_000, 'concluida_em deve ser "agora"');

    const segunda = await chamar('PATCH', `/api/tarefas/${tarefa.id}/concluir`);
    assert.equal(segunda.status, 409);
    assert.match(segunda.corpo.erro, /já foi concluída/);

    const [noBanco] = await linhasNoBanco('Conferir diários de classe');
    assert.equal(noBanco.concluida_em.getTime(), concluidaEm, 'o 409 não pode alterar a data gravada');
  });

  test('CA3 sob concorrência: 5 "concluir" ao mesmo tempo -> exatamente 1 x 200 e 4 x 409', async () => {
    const { corpo: tarefa } = await criar({ titulo: 'Cliques simultâneos' });
    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => chamar('PATCH', `/api/tarefas/${tarefa.id}/concluir`)),
    );
    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [200, 409, 409, 409, 409]);
  });

  test('CA4 (regra central): pendente e concluída com prazo de ontem -> "atrasadas" mostra só a pendente', async () => {
    // Preparação (como a ficha orienta): a API recusa prazo no passado, então inserimos direto no banco.
    const pool = await banco.obterPool();
    await pool.request()
      .input('marca', banco.sql.NVarChar(80), marca)
      .input('hoje', banco.sql.VarChar(10), (await chamar('GET', '/health')).corpo.hoje)
      .query(`
        DECLARE @ontem date = DATEADD(DAY, -1, CONVERT(date, @hoje, 23));
        INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo, concluida_em, criada_em) VALUES
          (N'CA4 pendente com prazo de ontem',  @marca, 'alta',  @ontem, NULL,
           DATEADD(DAY, -2, SYSDATETIMEOFFSET())),
          (N'CA4 concluída com prazo de ontem', @marca, 'media', @ontem, DATEADD(DAY, -1, SYSDATETIMEOFFSET()),
           DATEADD(DAY, -2, SYSDATETIMEOFFSET()));`);

    const r = await chamar('GET', `/api/tarefas?situacao=atrasadas&responsavel=${encodeURIComponent(marca)}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.tarefas.map((t) => t.titulo), ['CA4 pendente com prazo de ontem']);
    assert.equal(r.corpo.tarefas[0].situacao, 'atrasada');

    const todas = await chamar('GET', `/api/tarefas?responsavel=${encodeURIComponent(marca)}`);
    const concluida = todas.corpo.tarefas.find((t) => t.titulo === 'CA4 concluída com prazo de ontem');
    assert.equal(concluida.situacao, 'concluida', 'concluída nunca é atrasada');
  });

  test('CA5 (negativo): excluir id inexistente -> 404; excluir existente -> 204', async () => {
    const { corpo: tarefa } = await criar({ titulo: 'Tarefa para excluir' });
    assert.equal((await chamar('DELETE', `/api/tarefas/${tarefa.id}`)).status, 204);
    assert.equal((await linhasNoBanco('Tarefa para excluir')).length, 0);
    const deNovo = await chamar('DELETE', `/api/tarefas/${tarefa.id}`);
    assert.equal(deNovo.status, 404);
    assert.equal(deNovo.corpo.erro, 'Tarefa não encontrada.');
  });

  test('Segurança: injeção de SQL no filtro é tratada como texto comum', async () => {
    const r = await chamar('GET', `/api/tarefas?responsavel=${encodeURIComponent("x' OR 1=1 --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.total, 0);
  });

  test('Extras: filtro por responsável sem diferenciar maiúsculas, contadores e reabrir', async () => {
    const parteDoNome = marca.slice(-6).toUpperCase();
    const lista = await chamar('GET', `/api/tarefas?responsavel=${encodeURIComponent(parteDoNome)}`);
    assert.ok(lista.corpo.total >= 1);
    assert.ok(lista.corpo.tarefas.every((t) => t.responsavel === marca));

    const contadores = await chamar('GET', `/api/tarefas/contadores?responsavel=${encodeURIComponent(marca)}`);
    assert.equal(contadores.status, 200);
    assert.equal(contadores.corpo.atrasadas, 1);
    assert.equal(contadores.corpo.total, contadores.corpo.pendentes + contadores.corpo.concluidas);

    const { corpo: tarefa } = await criar({ titulo: 'Tarefa para reabrir' });
    await chamar('PATCH', `/api/tarefas/${tarefa.id}/concluir`);
    const reaberta = await chamar('PATCH', `/api/tarefas/${tarefa.id}/reabrir`);
    assert.equal(reaberta.status, 200);
    assert.equal(reaberta.corpo.concluida_em, null);
    assert.equal((await chamar('PATCH', `/api/tarefas/${tarefa.id}/reabrir`)).status, 409);
  });

  test('Erros claros: id inválido -> 400, JSON malformado -> 400, rota inexistente -> 404', async () => {
    assert.equal((await chamar('GET', '/api/tarefas/abc')).status, 400);
    const malformado = await fetch(`${base}/api/tarefas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"titulo":',
    });
    assert.equal(malformado.status, 400);
    assert.equal((await chamar('GET', '/api/nao-existe')).status, 404);
  });
});
