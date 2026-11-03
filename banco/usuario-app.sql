/* =====================================================================
   G01 · Usuário da APLICAÇÃO (sem privilégio de administrador)

   Por quê: a aplicação não usa o login administrador do servidor. Se a
   DATABASE_URL vazar, o estrago fica limitado a ler/gravar a tabela
   tarefas: não dá para apagar a tabela, criar usuários nem mexer em
   outros bancos.

   Como usar (Editor de consultas, logado como ADMINISTRADOR, no banco
   da aplicação — NÃO no master):
     1. Troque <TROQUE-AQUI> por uma senha forte. O texto atual é
        propositalmente inválido: o banco recusa a senha até ser trocado.
     2. Execute.
     3. Use app_mural + essa senha na DATABASE_URL do App Service.
        A senha NUNCA vai para o Git nem para print.
   ===================================================================== */

-- Usuário "contido": existe só dentro deste banco (não precisa de login no master).
CREATE USER app_mural WITH PASSWORD = N'<TROQUE-AQUI>';

-- Só o necessário para o CRUD da aplicação. Nada de db_owner, ALTER ou DROP.
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.tarefas TO app_mural;

-- Conferência: deve mostrar só CONNECT (automático) e SELECT, INSERT, UPDATE, DELETE em tarefas.
SELECT pr.name AS usuario, pe.permission_name AS permissao, OBJECT_NAME(pe.major_id) AS objeto
FROM sys.database_permissions AS pe
JOIN sys.database_principals AS pr ON pr.principal_id = pe.grantee_principal_id
WHERE pr.name = N'app_mural';

/* Para trocar a senha depois (ex.: se ela aparecer num print):
   ALTER USER app_mural WITH PASSWORD = N'<NOVA-SENHA>';
   e atualize a DATABASE_URL no App Service. */
