/* =====================================================================
   G01 · Mural da Coordenação — tabela e restrições
   Banco: Azure SQL Database (T-SQL). Também roda em SQL Server 2017+.

   Como usar: Portal do Azure > banco > Editor de consultas, logado como
   ADMINISTRADOR do servidor. Depois rode banco/usuario-app.sql.
   O script é idempotente: rodar de novo não apaga nem duplica nada.
   (Sem "GO" de propósito: o Editor de consultas executa um lote só.)
   ===================================================================== */

-- Sem isto, o Azure SQL pode "pular" ~1000 números de id depois que o banco
-- pausa e retoma (cache de IDENTITY). Custa quase nada em desempenho.
ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;

IF OBJECT_ID(N'dbo.tarefas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tarefas (
        id           INT IDENTITY(1,1) NOT NULL,
        titulo       NVARCHAR(120)     NOT NULL,  -- NVARCHAR: aceita acentos; 120 = limite da ficha
        responsavel  NVARCHAR(80)      NOT NULL,
        prioridade   VARCHAR(5)        NOT NULL
                     CONSTRAINT df_tarefas_prioridade DEFAULT ('media'),
        prazo        DATE              NULL,      -- opcional; só a data (sem hora)
        concluida_em DATETIMEOFFSET(3) NULL,      -- NULL = pendente; preenchida = concluída (equivale ao TIMESTAMPTZ do PostgreSQL)
        criada_em    DATETIMEOFFSET(3) NOT NULL
                     CONSTRAINT df_tarefas_criada_em DEFAULT (SYSDATETIMEOFFSET()),

        CONSTRAINT pk_tarefas PRIMARY KEY (id),
        -- Últimas linhas de defesa: a API já valida tudo isso antes (respostas 400).
        CONSTRAINT ck_tarefas_titulo      CHECK (LEN(TRIM(titulo)) >= 3),
        CONSTRAINT ck_tarefas_responsavel CHECK (LEN(TRIM(responsavel)) >= 2),
        CONSTRAINT ck_tarefas_prioridade  CHECK (prioridade IN ('baixa', 'media', 'alta')),
        CONSTRAINT ck_tarefas_conclusao   CHECK (concluida_em IS NULL OR concluida_em >= criada_em)
    );
END;

-- Índice para o filtro "atrasadas" (concluida_em IS NULL AND prazo < hoje):
-- o banco vai direto às pendentes e percorre só os prazos vencidos.
-- (Um índice FILTRADO foi testado e descartado: ele faz qualquer INSERT falhar
--  em ferramentas com QUOTED_IDENTIFIER desligado, como o sqlcmd padrão.)
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'ix_tarefas_situacao_prazo'
                 AND object_id = OBJECT_ID(N'dbo.tarefas'))
    CREATE INDEX ix_tarefas_situacao_prazo
        ON dbo.tarefas (concluida_em, prazo);

-- Conferência: deve listar a tabela e as restrições.
SELECT name AS restricao, type_desc AS tipo
FROM sys.objects
WHERE parent_object_id = OBJECT_ID(N'dbo.tarefas')
ORDER BY type_desc, name;
