'use strict';
/*
 * Testes de unidade: regras puras, sem banco. Rodam em qualquer máquina.
 *   npm run test:unidade
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { hojeEmBrasilia, ehDataValida } = require('../src/datas');
const { validarNovaTarefa, lerId, lerFiltros } = require('../src/validacao');
const { escaparLike } = require('../src/repositorio-tarefas');
const { traduzirErroDoBanco } = require('../src/erros');

const HOJE = '2026-11-03';

/** Executa fn e devolve o HttpErro lançado (falha se não lançar). */
function erroDe(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  assert.fail('era esperado um erro');
}

describe('"hoje" é o de Brasília, não o do servidor (UTC)', () => {
  test('22h30 em Brasília (01h30 UTC do dia seguinte) ainda é o mesmo dia', () => {
    assert.equal(hojeEmBrasilia(new Date('2026-11-04T01:30:00Z')), '2026-11-03');
  });
  test('o dia vira à meia-noite de Brasília (03h00 UTC)', () => {
    assert.equal(hojeEmBrasilia(new Date('2026-11-04T02:59:59Z')), '2026-11-03');
    assert.equal(hojeEmBrasilia(new Date('2026-11-04T03:00:00Z')), '2026-11-04');
  });
});

describe('datas AAAA-MM-DD', () => {
  test('aceita datas reais, inclusive 29/02 em ano bissexto', () => {
    assert.ok(ehDataValida('2026-11-30'));
    assert.ok(ehDataValida('2028-02-29'));
  });
  test('recusa datas inexistentes e outros formatos', () => {
    for (const texto of ['2026-02-30', '2026-02-29', '2026-13-01', '30/11/2026', '2026-1-5', '', null]) {
      assert.equal(ehDataValida(texto), false, String(texto));
    }
  });
});

describe('RF1: validação do cadastro', () => {
  const valido = { titulo: 'Reservar o auditório', responsavel: 'Ana Exemplo' };

  test('CA1: título com 2 caracteres -> 400 com mensagem', () => {
    const err = erroDe(() => validarNovaTarefa({ ...valido, titulo: 'ab' }, HOJE));
    assert.equal(err.status, 400);
    assert.match(err.message, /entre 3 e 120 caracteres/);
    assert.ok(err.extras.campos.titulo);
  });

  test('CA1: espaços nas pontas não contam como caracteres', () => {
    assert.equal(erroDe(() => validarNovaTarefa({ ...valido, titulo: '   ab   ' }, HOJE)).status, 400);
  });

  test('título com 3 e com 120 caracteres é aceito; com 121 é recusado', () => {
    assert.equal(validarNovaTarefa({ ...valido, titulo: 'abc' }, HOJE).titulo, 'abc');
    assert.equal(validarNovaTarefa({ ...valido, titulo: 'x'.repeat(120) }, HOJE).titulo.length, 120);
    assert.equal(erroDe(() => validarNovaTarefa({ ...valido, titulo: 'x'.repeat(121) }, HOJE)).status, 400);
  });

  test('CA2: prazo anterior a hoje -> 400', () => {
    const err = erroDe(() => validarNovaTarefa({ ...valido, prazo: '2026-11-02' }, HOJE));
    assert.equal(err.status, 400);
    assert.match(err.message, /anterior a hoje \(03\/11\/2026/);
  });

  test('prazo igual a hoje, futuro ou ausente é aceito', () => {
    assert.equal(validarNovaTarefa({ ...valido, prazo: HOJE }, HOJE).prazo, HOJE);
    assert.equal(validarNovaTarefa({ ...valido, prazo: '2027-01-15' }, HOJE).prazo, '2027-01-15');
    assert.equal(validarNovaTarefa({ ...valido }, HOJE).prazo, null);
    assert.equal(validarNovaTarefa({ ...valido, prazo: '' }, HOJE).prazo, null);
  });

  test('prazo em formato errado -> 400', () => {
    assert.equal(erroDe(() => validarNovaTarefa({ ...valido, prazo: '30/11/2026' }, HOJE)).status, 400);
  });

  test('prioridade: padrão "media"; aceita "Média" e "ALTA"; recusa "urgente"', () => {
    assert.equal(validarNovaTarefa(valido, HOJE).prioridade, 'media');
    assert.equal(validarNovaTarefa({ ...valido, prioridade: 'Média' }, HOJE).prioridade, 'media');
    assert.equal(validarNovaTarefa({ ...valido, prioridade: 'ALTA' }, HOJE).prioridade, 'alta');
    assert.equal(erroDe(() => validarNovaTarefa({ ...valido, prioridade: 'urgente' }, HOJE)).status, 400);
  });

  test('responsável é obrigatório', () => {
    const err = erroDe(() => validarNovaTarefa({ titulo: 'Reservar o auditório' }, HOJE));
    assert.equal(err.status, 400);
    assert.ok(err.extras.campos.responsavel);
  });

  test('vários erros voltam juntos, um por campo', () => {
    const err = erroDe(() => validarNovaTarefa({ titulo: 'a', prazo: '2020-01-01' }, HOJE));
    assert.deepEqual(Object.keys(err.extras.campos).sort(), ['prazo', 'responsavel', 'titulo']);
  });

  test('campos extras (ex.: concluida_em) são ignorados', () => {
    const dados = validarNovaTarefa({ ...valido, concluida_em: '2020-01-01T00:00:00Z', id: 99 }, HOJE);
    assert.deepEqual(Object.keys(dados).sort(), ['prazo', 'prioridade', 'responsavel', 'titulo']);
  });

  test('corpo que não é objeto JSON -> 400', () => {
    for (const corpo of [undefined, null, 'texto', [1, 2]]) {
      assert.equal(erroDe(() => validarNovaTarefa(corpo, HOJE)).status, 400);
    }
  });
});

describe('id da URL', () => {
  test('número inteiro positivo é aceito', () => assert.equal(lerId('42'), 42));
  test('texto, zero, negativo e decimal -> 400', () => {
    for (const texto of ['abc', '0', '-1', '1.5', '1e3', '']) assert.equal(erroDe(() => lerId(texto)).status, 400, texto);
  });
  test('acima do limite do INT não existe -> 404', () => {
    assert.equal(erroDe(() => lerId('2147483648')).status, 404);
  });
});

describe('filtros da listagem', () => {
  test('situações válidas, com ou sem acento', () => {
    assert.equal(lerFiltros({ situacao: 'atrasadas' }).situacao, 'atrasadas');
    assert.equal(lerFiltros({ situacao: 'Concluídas' }).situacao, 'concluidas');
    assert.equal(lerFiltros({ situacao: 'todas' }).situacao, null);
    assert.equal(lerFiltros({}).situacao, null);
  });
  test('situação desconhecida, repetida ou responsável longo demais -> 400', () => {
    assert.equal(erroDe(() => lerFiltros({ situacao: 'arquivadas' })).status, 400);
    assert.equal(erroDe(() => lerFiltros({ situacao: ['pendentes', 'atrasadas'] })).status, 400);
    assert.equal(erroDe(() => lerFiltros({ responsavel: 'x'.repeat(81) })).status, 400);
  });
});

describe('segurança e erros do banco', () => {
  test('curingas do LIKE são escapados (o texto é buscado literalmente)', () => {
    assert.equal(escaparLike('50%_[x]'), '50[%][_][[]x]');
  });
  test('banco fora do ar ou pausado -> 503; restrição CHECK -> 400; desconhecido -> null (500)', () => {
    assert.equal(traduzirErroDoBanco({ name: 'ConnectionError', code: 'ESOCKET' }).status, 503);
    assert.equal(traduzirErroDoBanco({ name: 'RequestError', number: 40613 }).status, 503);
    assert.equal(traduzirErroDoBanco({ code: 'ENOCONFIG' }).status, 503);
    assert.equal(traduzirErroDoBanco({ name: 'RequestError', number: 547 }).status, 400);
    assert.equal(traduzirErroDoBanco({ name: 'RequestError', number: 102 }), null);
  });
});
