'use strict';
/*
 * Tela do Mural da Coordenação (JavaScript puro, sem framework).
 * A tela só conversa com a API; quem valida e decide é o servidor.
 * Textos digitados são exibidos com textContent (nunca innerHTML): sem risco de XSS.
 */

const FUSO = 'America/Sao_Paulo';
const PRIORIDADE_ROTULO = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const SITUACAO_ROTULO = { pendente: 'Pendente', atrasada: 'Atrasada', concluida: 'Concluída' };
const VAZIO_POR_FILTRO = {
  '': 'Nenhuma tarefa cadastrada ainda.',
  pendentes: 'Nenhuma tarefa pendente.',
  atrasadas: 'Nenhuma tarefa atrasada.',
  concluidas: 'Nenhuma tarefa concluída.',
};

const estado = { situacao: '', responsavel: '' };
const $ = (id) => document.getElementById(id);

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const formatoRelogio = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** "2026-11-30" -> "30/11/2026" sem usar Date (evita o dia "pular" por causa do fuso). */
function dataBR(aaaammdd) {
  if (!aaaammdd) return 'sem prazo';
  const [a, m, d] = aaaammdd.split('-');
  return `${d}/${m}/${a}`;
}

const dataHoraBR = (iso) => formatoDataHora.format(new Date(iso));

/** Chama a API e devolve { ok, status, dados } sem lançar exceção. */
async function api(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: { Accept: 'application/json' } };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  try {
    const resposta = await fetch(url, opcoes);
    let dados = null;
    if (resposta.status !== 204) {
      try { dados = await resposta.json(); } catch { dados = null; }
    }
    return { ok: resposta.ok, status: resposta.status, dados };
  } catch {
    return { ok: false, status: 0, dados: { erro: 'Sem conexão com o servidor. Verifique a internet e tente de novo.' } };
  }
}

function mostrarMensagem(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = `mensagem mensagem--${tipo}`;
}

function textoDoErro(resposta) {
  const base = resposta.dados?.erro ?? 'Algo deu errado. Tente novamente.';
  return resposta.status ? `${base} (HTTP ${resposta.status})` : base;
}

/* ---------- Saúde do banco + relógio ---------- */

async function atualizarSaude() {
  const pilula = $('saude');
  const r = await api('GET', '/health');
  if (r.dados?.iniciado_em) $('iniciado-em').textContent = formatoRelogio.format(new Date(r.dados.iniciado_em));
  if (r.dados?.hoje) $('hoje').textContent = dataBR(r.dados.hoje);
  if (r.ok) {
    pilula.textContent = 'Banco conectado';
    pilula.className = 'pilula pilula--ok';
  } else {
    pilula.textContent = r.status === 503 ? 'Banco indisponível' : 'Servidor indisponível';
    pilula.className = 'pilula pilula--erro';
  }
}

function atualizarRelogio() {
  $('agora').textContent = formatoRelogio.format(new Date());
}

/* ---------- Lista ---------- */

function parametrosDaLista() {
  const p = new URLSearchParams();
  if (estado.situacao) p.set('situacao', estado.situacao);
  if (estado.responsavel) p.set('responsavel', estado.responsavel);
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}

async function carregarContadores() {
  const p = new URLSearchParams();
  if (estado.responsavel) p.set('responsavel', estado.responsavel);
  const r = await api('GET', `/api/tarefas/contadores${p.size ? `?${p}` : ''}`);
  if (!r.ok) return;
  for (const chave of ['total', 'pendentes', 'atrasadas', 'concluidas']) {
    const alvo = document.querySelector(`[data-contador="${chave}"]`);
    alvo.textContent = r.dados[chave];
    alvo.toggleAttribute('data-zero', r.dados[chave] === 0);
  }
}

async function carregarTarefas() {
  const lista = $('lista');
  const msg = $('msg-lista');
  const r = await api('GET', `/api/tarefas${parametrosDaLista()}`);
  if (!r.ok) {
    lista.replaceChildren();
    mostrarMensagem(msg, textoDoErro(r), 'erro');
    return;
  }
  msg.textContent = '';
  if (r.dados.hoje) $('hoje').textContent = dataBR(r.dados.hoje);
  if (r.dados.tarefas.length === 0) {
    const vazio = document.createElement('li');
    vazio.className = 'lista__vazia';
    vazio.textContent = estado.responsavel
      ? `Nenhuma tarefa encontrada para "${estado.responsavel}" neste filtro.`
      : VAZIO_POR_FILTRO[estado.situacao];
    lista.replaceChildren(vazio);
    return;
  }
  lista.replaceChildren(...r.dados.tarefas.map(criarItem));
}

function criarItem(t) {
  const item = $('modelo-tarefa').content.firstElementChild.cloneNode(true);
  item.classList.add(`tarefa--${t.situacao}`);
  item.dataset.id = t.id;

  const seloSituacao = item.querySelector('.selo--situacao');
  seloSituacao.textContent = SITUACAO_ROTULO[t.situacao];
  seloSituacao.classList.add(`selo--${t.situacao}`);

  const seloPrioridade = item.querySelector('.selo--prioridade');
  seloPrioridade.textContent = `Prioridade ${PRIORIDADE_ROTULO[t.prioridade]}`;
  seloPrioridade.classList.add(`selo--${t.prioridade}`);

  item.querySelector('.tarefa__id').textContent = `#${t.id}`;
  item.querySelector('.tarefa__titulo').textContent = t.titulo;
  item.querySelector('.tarefa__responsavel').textContent = t.responsavel;
  item.querySelector('.tarefa__prazo').textContent = dataBR(t.prazo);
  item.querySelector('.tarefa__criada').textContent = dataHoraBR(t.criada_em);

  const concluida = t.situacao === 'concluida';
  item.querySelector('.tarefa__conclusao').hidden = !concluida;
  if (concluida) item.querySelector('.tarefa__concluida').textContent = dataHoraBR(t.concluida_em);

  item.querySelector('[data-acao="concluir"]').hidden = concluida;
  item.querySelector('[data-acao="reabrir"]').hidden = !concluida;
  for (const botao of item.querySelectorAll('[data-acao]')) {
    botao.setAttribute('aria-label', `${botao.textContent}: ${t.titulo}`);
    botao.addEventListener('click', () => executarAcao(botao, botao.dataset.acao, t));
  }
  return item;
}

async function executarAcao(botao, acao, tarefa) {
  const msg = $('msg-lista');
  if (acao === 'excluir' && !window.confirm(`Excluir a tarefa "${tarefa.titulo}"? Não dá para desfazer.`)) return;

  botao.disabled = true;
  const r = acao === 'excluir'
    ? await api('DELETE', `/api/tarefas/${tarefa.id}`)
    : await api('PATCH', `/api/tarefas/${tarefa.id}/${acao}`);
  botao.disabled = false;

  if (r.ok) {
    const textos = {
      concluir: `Tarefa #${tarefa.id} concluída em ${r.dados ? dataHoraBR(r.dados.concluida_em) : ''}.`,
      reabrir: `Tarefa #${tarefa.id} reaberta.`,
      excluir: `Tarefa #${tarefa.id} excluída.`,
    };
    await recarregar();
    mostrarMensagem(msg, textos[acao], 'ok');
  } else {
    // Ex.: 409 "já foi concluída" (outra pessoa concluiu antes) ou 404 (já foi excluída).
    await recarregar();
    mostrarMensagem(msg, textoDoErro(r), 'erro');
  }
}

async function recarregar() {
  await Promise.all([carregarTarefas(), carregarContadores()]);
}

/* ---------- Cadastro ---------- */

function limparErrosDoForm() {
  for (const p of document.querySelectorAll('.erro-campo')) p.textContent = '';
  for (const campo of document.querySelectorAll('#form-tarefa [aria-invalid]')) campo.removeAttribute('aria-invalid');
}

async function cadastrar(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const msg = $('msg-form');
  const botao = $('botao-cadastrar');
  limparErrosDoForm();
  msg.textContent = '';

  const corpo = {
    titulo: form.titulo.value,
    responsavel: form.responsavel.value,
    prazo: form.prazo.value || null,
    prioridade: form.prioridade.value,
  };

  botao.disabled = true;
  const r = await api('POST', '/api/tarefas', corpo);
  botao.disabled = false;

  if (r.ok) {
    mostrarMensagem(msg, `Tarefa #${r.dados.id} "${r.dados.titulo}" cadastrada.`, 'ok');
    form.titulo.value = '';
    form.prazo.value = '';
    form.prioridade.value = 'media';
    form.titulo.focus();
    await recarregar();
    return;
  }

  // 400: mostra a mensagem do SERVIDOR embaixo de cada campo com problema.
  const campos = r.dados?.campos ?? {};
  const nomes = Object.keys(campos);
  for (const nome of nomes) {
    const alvo = document.querySelector(`.erro-campo[data-campo="${nome}"]`);
    if (alvo) alvo.textContent = campos[nome];
    form.elements[nome]?.setAttribute('aria-invalid', 'true');
  }
  const resumo = nomes.length > 0
    ? `O servidor recusou o cadastro (HTTP ${r.status}): ${nomes.length > 1 ? 'corrija os campos destacados' : 'corrija o campo destacado'}.`
    : textoDoErro(r);
  mostrarMensagem(msg, resumo, 'erro');
  const primeiroInvalido = form.querySelector('[aria-invalid="true"]');
  if (primeiroInvalido) primeiroInvalido.focus();
}

/* ---------- Filtros ---------- */

function escolherSituacao(botao) {
  estado.situacao = botao.dataset.situacao;
  for (const b of document.querySelectorAll('.filtro')) b.setAttribute('aria-pressed', String(b === botao));
  $('msg-lista').textContent = '';
  carregarTarefas();
}

let esperaDigitacao;
function filtrarResponsavel(evento) {
  clearTimeout(esperaDigitacao);
  esperaDigitacao = setTimeout(() => {
    estado.responsavel = evento.target.value.trim();
    recarregar();
  }, 300);
}

/* ---------- Início ---------- */

document.addEventListener('DOMContentLoaded', () => {
  $('form-tarefa').addEventListener('submit', cadastrar);
  for (const b of document.querySelectorAll('.filtro')) b.addEventListener('click', () => escolherSituacao(b));
  $('filtro-responsavel').addEventListener('input', filtrarResponsavel);

  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  atualizarSaude();
  setInterval(atualizarSaude, 30_000);
  recarregar();
});
