/* =====================================================================
   G01 · Consultas diretas no banco para as evidências
   Rodar no Editor de consultas do portal (ou em qualquer cliente SQL).
   Dica: selecione só o trecho que quer rodar e clique em Executar.
   ===================================================================== */

-- 1) Prova de persistência (Print 4): a MESMA linha gravada pela aplicação.
--    Troque PALAVRA pela palavra do dia (ex.: G01-NIMBUS).
SELECT id, titulo, responsavel, prioridade, prazo, concluida_em, criada_em
FROM dbo.tarefas
WHERE titulo LIKE N'G01-%';

-- 2) Teste do professor (Nível A): registro PROF-HHMM criado pela URL pública.
SELECT id, titulo, responsavel, criada_em
FROM dbo.tarefas
WHERE titulo LIKE N'PROF-%';

-- 3) CA4 direto no banco: a mesma regra do filtro "atrasadas" da API.
DECLARE @hoje DATE =
    CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE);

SELECT id, titulo, prazo, concluida_em, @hoje AS hoje_brasilia
FROM dbo.tarefas
WHERE concluida_em IS NULL
  AND prazo < @hoje;

-- 4) Contadores (o mesmo cálculo da rota /api/tarefas/contadores).
SELECT COUNT(*)                                                           AS total,
       ISNULL(SUM(CASE WHEN concluida_em IS NULL THEN 1 ELSE 0 END), 0)  AS pendentes,
       ISNULL(SUM(CASE WHEN concluida_em IS NULL AND prazo < @hoje
                       THEN 1 ELSE 0 END), 0)                             AS atrasadas,
       ISNULL(SUM(CASE WHEN concluida_em IS NOT NULL THEN 1 ELSE 0 END), 0) AS concluidas
FROM dbo.tarefas;

-- 5) Horários: o banco grava em UTC (+00:00); a tela mostra em Brasília.
SELECT id, titulo,
       criada_em,
       criada_em    AT TIME ZONE 'E. South America Standard Time' AS criada_em_brasilia,
       concluida_em AT TIME ZONE 'E. South America Standard Time' AS concluida_em_brasilia
FROM dbo.tarefas
ORDER BY id;

-- 6) Restrições da tabela (para mostrar na apresentação).
SELECT name AS restricao, type_desc AS tipo, definition AS regra
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.tarefas');
