'use strict';
/*
 * Rotas da API de tarefas (montadas em /api/tarefas) e regras de negócio.
 * O Express 5 encaminha qualquer erro lançado aqui para o tratador de erros.
 */
const express = require('express');
const repo = require('./repositorio-tarefas');
const { HttpErro } = require('./erros');
const { hojeEmBrasilia, formatarDataHoraBR } = require('./datas');
const { validarNovaTarefa, lerId, lerFiltros } = require('./validacao');

const router = express.Router();

const naoEncontrada = () => new HttpErro(404, 'Tarefa não encontrada.');
const alteradaAoMesmoTempo = () =>
  new HttpErro(409, 'A tarefa foi alterada por outra pessoa ao mesmo tempo. Atualize a lista e tente de novo.');

// RF2 + RF4 (+ extra: filtro por responsável)
// GET /api/tarefas?situacao=pendentes|concluidas|atrasadas&responsavel=texto
router.get('/', async (req, res) => {
  const filtros = lerFiltros(req.query);
  const hoje = hojeEmBrasilia();
  const tarefas = await repo.listar(filtros, hoje);
  res.json({ hoje, filtros, total: tarefas.length, tarefas });
});

// Extra: contadores (pendentes / atrasadas / concluídas), respeitando o filtro de responsável.
router.get('/contadores', async (req, res) => {
  const { responsavel } = lerFiltros(req.query);
  const hoje = hojeEmBrasilia();
  res.json({ hoje, ...(await repo.contar({ responsavel }, hoje)) });
});

router.get('/:id', async (req, res) => {
  const id = lerId(req.params.id);
  const tarefa = await repo.buscarPorId(id, hojeEmBrasilia());
  if (!tarefa) throw naoEncontrada();
  res.json(tarefa);
});

// RF1: cadastrar. CA1 e CA2 são barrados na validação (400) antes de chegar ao banco.
router.post('/', async (req, res) => {
  const hoje = hojeEmBrasilia();
  const dados = validarNovaTarefa(req.body, hoje);
  const tarefa = await repo.criar(dados, hoje);
  res.status(201).location(`/api/tarefas/${tarefa.id}`).json(tarefa);
});

// RF3 (regra central) / CA3: concluir uma pendente -> 200 com concluida_em; concluir de novo -> 409.
router.patch('/:id/concluir', async (req, res) => {
  const id = lerId(req.params.id);
  const hoje = hojeEmBrasilia();

  const concluida = await repo.concluir(id, hoje);
  if (concluida) return res.json(concluida);

  // Nada foi alterado: ou o id não existe (404) ou a tarefa já estava concluída (409).
  const atual = await repo.buscarPorId(id, hoje);
  if (!atual) throw naoEncontrada();
  if (!atual.concluida_em) throw alteradaAoMesmoTempo();
  throw new HttpErro(409, `Esta tarefa já foi concluída em ${formatarDataHoraBR(atual.concluida_em)} (horário de Brasília).`, {
    concluida_em: atual.concluida_em,
  });
});

// Extra: reabrir uma tarefa concluída (volta a ser pendente/atrasada).
router.patch('/:id/reabrir', async (req, res) => {
  const id = lerId(req.params.id);
  const hoje = hojeEmBrasilia();

  const reaberta = await repo.reabrir(id, hoje);
  if (reaberta) return res.json(reaberta);

  const atual = await repo.buscarPorId(id, hoje);
  if (!atual) throw naoEncontrada();
  if (atual.concluida_em) throw alteradaAoMesmoTempo();
  throw new HttpErro(409, 'Esta tarefa não está concluída; não há o que reabrir.');
});

// RF5 / CA5: excluir. Id inexistente -> 404.
router.delete('/:id', async (req, res) => {
  const id = lerId(req.params.id);
  const apagou = await repo.excluir(id);
  if (!apagou) throw naoEncontrada();
  res.status(204).end();
});

module.exports = router;
