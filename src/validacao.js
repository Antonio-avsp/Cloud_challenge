'use strict';
/*
 * Validação das entradas NO SERVIDOR (a tela também ajuda, mas quem decide é aqui).
 * Qualquer problema vira 400 com mensagem clara, por campo.
 */
const { HttpErro } = require('./erros');
const { ehDataValida, formatarDataBR } = require('./datas');

const PRIORIDADES = ['baixa', 'media', 'alta'];
const SITUACOES = ['pendentes', 'concluidas', 'atrasadas'];
const ID_MAXIMO = 2_147_483_647; // maior valor de INT no SQL Server

/** "Média" -> "media": aceita com ou sem acento, maiúsculas ou minúsculas. */
function normalizar(texto) {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function vazio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

/**
 * RF1: valida o corpo do cadastro e devolve só os campos permitidos
 * (campos extras, como concluida_em, são ignorados: o cliente não escolhe isso).
 * CA1: título fora de 3..120 caracteres -> 400.
 * CA2: prazo anterior a hoje (Brasília) -> 400.
 */
function validarNovaTarefa(corpo, hoje) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new HttpErro(400, 'Envie um JSON com titulo, responsavel, prazo (opcional) e prioridade (opcional).');
  }
  const campos = {};

  let titulo = null;
  if (typeof corpo.titulo !== 'string' || corpo.titulo.trim() === '') {
    campos.titulo = 'O título é obrigatório (3 a 120 caracteres).';
  } else {
    titulo = corpo.titulo.trim();
    if (titulo.length < 3 || titulo.length > 120) {
      campos.titulo = `O título deve ter entre 3 e 120 caracteres (recebido: ${titulo.length}).`;
    }
  }

  let responsavel = null;
  if (typeof corpo.responsavel !== 'string' || corpo.responsavel.trim() === '') {
    campos.responsavel = 'O responsável é obrigatório.';
  } else {
    responsavel = corpo.responsavel.trim();
    if (responsavel.length < 2 || responsavel.length > 80) {
      campos.responsavel = `O responsável deve ter entre 2 e 80 caracteres (recebido: ${responsavel.length}).`;
    }
  }

  let prioridade = 'media'; // padrão da ficha
  if (!vazio(corpo.prioridade)) {
    prioridade = typeof corpo.prioridade === 'string' ? normalizar(corpo.prioridade) : '';
    if (!PRIORIDADES.includes(prioridade)) {
      campos.prioridade = 'Prioridade inválida: use baixa, média ou alta.';
    }
  }

  let prazo = null; // opcional
  if (!vazio(corpo.prazo)) {
    prazo = typeof corpo.prazo === 'string' ? corpo.prazo.trim() : '';
    if (!ehDataValida(prazo)) {
      campos.prazo = 'Prazo inválido: use o formato AAAA-MM-DD (ex.: 2026-11-30).';
    } else if (prazo < hoje) {
      campos.prazo = `O prazo não pode ser anterior a hoje (${formatarDataBR(hoje)}, horário de Brasília).`;
    }
  }

  if (Object.keys(campos).length > 0) {
    throw new HttpErro(400, Object.values(campos).join(' '), { campos });
  }
  return { titulo, responsavel, prioridade, prazo };
}

/** id da URL: precisa ser inteiro positivo (senão 400). Acima do limite do INT não existe (404). */
function lerId(texto) {
  if (!/^[1-9]\d*$/.test(texto)) {
    throw new HttpErro(400, 'O id da tarefa deve ser um número inteiro positivo.');
  }
  const id = Number(texto);
  if (id > ID_MAXIMO) throw new HttpErro(404, 'Tarefa não encontrada.');
  return id;
}

/** Filtros da listagem: ?situacao=pendentes|concluidas|atrasadas&responsavel=texto */
function lerFiltros(query) {
  for (const nome of ['situacao', 'responsavel']) {
    if (query[nome] !== undefined && typeof query[nome] !== 'string') {
      throw new HttpErro(400, `Informe o filtro "${nome}" apenas uma vez.`);
    }
  }
  let situacao = query.situacao ? normalizar(query.situacao) : '';
  if (situacao === 'todas') situacao = '';
  if (situacao && !SITUACOES.includes(situacao)) {
    throw new HttpErro(400, 'Situação inválida: use pendentes, concluidas ou atrasadas.');
  }
  const responsavel = query.responsavel ? query.responsavel.trim() : '';
  if (responsavel.length > 80) {
    throw new HttpErro(400, 'O filtro de responsável aceita até 80 caracteres.');
  }
  return { situacao: situacao || null, responsavel: responsavel || null };
}

module.exports = { PRIORIDADES, SITUACOES, validarNovaTarefa, lerId, lerFiltros };
