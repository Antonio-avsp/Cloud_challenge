'use strict';
/*
 * Regras de data do Mural.
 *
 * Decisão do grupo: o "hoje" é o de BRASÍLIA, não o do servidor.
 * O App Service roda em UTC: às 21h de Brasília já é "amanhã" em UTC.
 * Com o relógio do servidor, à noite (horário da aula!) uma tarefa com
 * prazo de hoje apareceria como atrasada e o cadastro com prazo de hoje
 * seria recusado. Por isso o fuso é fixo e explícito aqui.
 */

const FUSO_HORARIO = 'America/Sao_Paulo';

const partesDaData = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_HORARIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dataHoraBR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_HORARIO,
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Data de hoje em Brasília no formato AAAA-MM-DD. O parâmetro existe para os testes. */
function hojeEmBrasilia(agora = new Date()) {
  const p = Object.fromEntries(partesDaData.formatToParts(agora).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** true se o texto é uma data de calendário real em AAAA-MM-DD (recusa 2026-02-30, 30/11/2026...). */
function ehDataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/** AAAA-MM-DD -> DD/MM/AAAA (só texto, sem objeto Date: não existe risco de "pular" um dia por fuso). */
function formatarDataBR(texto) {
  const [ano, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Instante (Date) -> "DD/MM/AAAA HH:MM" no horário de Brasília. */
function formatarDataHoraBR(instante) {
  return dataHoraBR.format(new Date(instante));
}

module.exports = { FUSO_HORARIO, hojeEmBrasilia, ehDataValida, formatarDataBR, formatarDataHoraBR };
