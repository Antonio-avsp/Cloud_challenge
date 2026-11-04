/* =====================================================================
   G01 · Preparação do teste CA4 (filtro "atrasadas")

   A API recusa prazo no passado (CA2), então as duas tarefas com prazo
   de ONTEM são inseridas direto no banco, como a ficha orienta.
   "Ontem" é calculado no fuso de Brasília: o mesmo "hoje" da aplicação.

   Rodar no Editor de consultas (administrador). Depois, na aplicação:
     GET /api/tarefas?situacao=atrasadas
   Esperado: aparece SÓ "CA4 - pendente com prazo de ontem".
   ===================================================================== */

DECLARE @hoje_brasilia DATE =
    CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE);
DECLARE @ontem DATE = DATEADD(DAY, -1, @hoje_brasilia);

INSERT INTO dbo.tarefas (titulo, responsavel, prioridade, prazo, concluida_em, criada_em)
VALUES
    (N'CA4 - pendente com prazo de ontem',  N'Ana Exemplo',   'alta',  @ontem,
     NULL,                                      DATEADD(DAY, -2, SYSDATETIMEOFFSET())),
    (N'CA4 - concluída com prazo de ontem', N'Bruno Exemplo', 'media', @ontem,
     DATEADD(DAY, -1, SYSDATETIMEOFFSET()),     DATEADD(DAY, -2, SYSDATETIMEOFFSET()));

SELECT id, titulo, prazo, concluida_em, @hoje_brasilia AS hoje_brasilia
FROM dbo.tarefas
WHERE titulo LIKE N'CA4 - %'
ORDER BY id;

/* Limpeza depois da apresentação (opcional):
   DELETE FROM dbo.tarefas WHERE titulo LIKE N'CA4 - %'; */
