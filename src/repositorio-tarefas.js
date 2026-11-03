'use strict';
/*
 * Todo o SQL do Mural fica aqui.
 * SEMPRE parametrizado: o texto digitado entra como parâmetro (@titulo,
 * @responsavel...), nunca concatenado dentro do SQL. O único texto montado
 * em código são trechos fixos escritos por nós (nomes de coluna, WHERE).
 */
const { sql, obterPool } = require('./banco');

/*
 * Colunas devolvidas pela API. A "situação" NÃO é uma coluna da tabela:
 * ela é DERIVADA de concluida_em e do prazo, comparando com o "hoje" de
 * Brasília (@hoje_data). Assim nunca existe uma tarefa "concluída" sem
 * data de conclusão, e "atrasada" muda sozinha quando o dia vira.
 * O prazo sai como texto AAAA-MM-DD (estilo 23) para não "pular" um dia
 * por causa de fuso ao virar objeto Date no JavaScript.
 */
function colunas(t) {
  return `${t}.id, ${t}.titulo, ${t}.responsavel, ${t}.prioridade,
          CONVERT(char(10), ${t}.prazo, 23) AS prazo,
          ${t}.concluida_em, ${t}.criada_em,
          CASE WHEN ${t}.concluida_em IS NOT NULL THEN 'concluida'
               WHEN ${t}.prazo < @hoje_data       THEN 'atrasada'
               ELSE 'pendente' END AS situacao`;
}

// O "hoje" chega da aplicação como texto AAAA-MM-DD e vira DATE dentro do SQL.
const DECLARA_HOJE = 'DECLARE @hoje_data date = CONVERT(date, @hoje, 23);';

async function novaRequisicao(hoje) {
  const pool = await obterPool();
  const req = pool.request();
  if (hoje) req.input('hoje', sql.VarChar(10), hoje);
  return req;
}

/** Escapa os curingas do LIKE (% _ [) para buscar o texto literalmente. */
function escaparLike(texto) {
  return texto.replace(/[[%_]/g, (c) => `[${c}]`);
}

function montarFiltros(req, { situacao, responsavel }) {
  const condicoes = [];
  if (situacao === 'pendentes') condicoes.push('t.concluida_em IS NULL');
  if (situacao === 'concluidas') condicoes.push('t.concluida_em IS NOT NULL');
  // RF4 / CA4 (regra central): prazo anterior a hoje E tarefa não concluída.
  if (situacao === 'atrasadas') condicoes.push('t.concluida_em IS NULL AND t.prazo < @hoje_data');
  if (responsavel) {
    req.input('responsavel', sql.NVarChar(400), `%${escaparLike(responsavel)}%`);
    condicoes.push('t.responsavel LIKE @responsavel'); // sem diferenciar maiúsculas (collation CI do banco)
  }
  return condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
}

/** RF2: lista com filtros; pendentes primeiro, depois prioridade (alta > média > baixa) e prazo. */
async function listar(filtros, hoje) {
  const req = await novaRequisicao(hoje);
  const where = montarFiltros(req, filtros);
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    SELECT ${colunas('t')}
    FROM dbo.tarefas AS t
    ${where}
    ORDER BY CASE WHEN t.concluida_em IS NULL THEN 0 ELSE 1 END,
             CASE t.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
             CASE WHEN t.prazo IS NULL THEN 1 ELSE 0 END,
             t.prazo,
             t.id;`);
  return recordset;
}

/** Extra: contadores calculados pelo banco numa única consulta. */
async function contar({ responsavel }, hoje) {
  const req = await novaRequisicao(hoje);
  const where = montarFiltros(req, { responsavel });
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    SELECT COUNT(*) AS total,
           ISNULL(SUM(CASE WHEN t.concluida_em IS NULL THEN 1 ELSE 0 END), 0) AS pendentes,
           ISNULL(SUM(CASE WHEN t.concluida_em IS NULL AND t.prazo < @hoje_data
                           THEN 1 ELSE 0 END), 0) AS atrasadas,
           ISNULL(SUM(CASE WHEN t.concluida_em IS NOT NULL THEN 1 ELSE 0 END), 0) AS concluidas
    FROM dbo.tarefas AS t
    ${where};`);
  return recordset[0];
}

async function buscarPorId(id, hoje) {
  const req = await novaRequisicao(hoje);
  req.input('id', sql.Int, id);
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    SELECT ${colunas('t')} FROM dbo.tarefas AS t WHERE t.id = @id;`);
  return recordset[0] ?? null;
}

/** RF1: grava e devolve a linha como ficou no banco (id, criada_em, situação). */
async function criar({ titulo, responsavel, prioridade, prazo }, hoje) {
  const req = await novaRequisicao(hoje);
  req.input('titulo', sql.NVarChar(120), titulo);
  req.input('responsavel', sql.NVarChar(80), responsavel);
  req.input('prioridade', sql.VarChar(5), prioridade);
  req.input('prazo', sql.VarChar(10), prazo);
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo)
    OUTPUT ${colunas('inserted')}
    VALUES (@titulo, @responsavel, @prioridade, CONVERT(date, @prazo, 23));`);
  return recordset[0];
}

/**
 * RF3 (regra central): conclui SÓ se ainda estiver pendente, num único UPDATE.
 * O "AND concluida_em IS NULL" torna a operação atômica: se duas pessoas
 * clicarem juntas, só uma conclui; a outra recebe 409. A data e hora vêm
 * do relógio do banco (SYSDATETIMEOFFSET, em UTC).
 * Devolve a tarefa concluída, ou null se nada foi alterado.
 */
async function concluir(id, hoje) {
  const req = await novaRequisicao(hoje);
  req.input('id', sql.Int, id);
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    UPDATE dbo.tarefas
    SET concluida_em = SYSDATETIMEOFFSET()
    OUTPUT ${colunas('inserted')}
    WHERE id = @id AND concluida_em IS NULL;`);
  return recordset[0] ?? null;
}

/** Extra: reabre SÓ se estiver concluída (mesma ideia atômica do concluir). */
async function reabrir(id, hoje) {
  const req = await novaRequisicao(hoje);
  req.input('id', sql.Int, id);
  const { recordset } = await req.query(`
    ${DECLARA_HOJE}
    UPDATE dbo.tarefas
    SET concluida_em = NULL
    OUTPUT ${colunas('inserted')}
    WHERE id = @id AND concluida_em IS NOT NULL;`);
  return recordset[0] ?? null;
}

/** RF5: exclusão física. Devolve true se apagou, false se o id não existia. */
async function excluir(id) {
  const req = await novaRequisicao();
  req.input('id', sql.Int, id);
  const { rowsAffected } = await req.query('DELETE FROM dbo.tarefas WHERE id = @id;');
  return rowsAffected[0] === 1;
}

module.exports = { listar, contar, buscarPorId, criar, concluir, reabrir, excluir, escaparLike };
