# Guia do grupo G01: papéis, cronograma e pitch

O código, o banco e os testes já estão prontos e testados localmente. **A noite é para colocar na Azure, gerar as evidências e apresentar bem.** Todos precisam saber explicar o fluxo completo (seção 6): a pergunta pode ir para qualquer um.

## 1. Quem faz o quê

| Integrante | Papel | Entrega na aula | Arquivos que precisa dominar |
|---|---|---|---|
| **Antonio Vinicius** | DEV (API e regras) | Explica o CA3 (409) e o CA4; apoia o deploy; ajusta código se algo quebrar | `src/rotas-tarefas.js`, `src/validacao.js`, `src/datas.js` |
| **Lucas Vinicius** | DEV (interface) | Demonstração ao vivo no pitch; roda o `requisicoes.http` na URL pública | `public/app.js`, `requisicoes.http` |
| **Vinicius Trezena** | DADOS | Roda `schema.sql` e `usuario-app.sql` no Editor de consultas; prepara o CA4; **Print 4** (consulta direta) | `banco/*.sql`, `src/repositorio-tarefas.js` |
| **Renan Souza** | NUVEM | Cria grupo de recursos, Azure SQL e App Service; firewall; `DATABASE_URL`; deploy; logs; **E1** e **E5** | `src/banco.js`, `.env.example`, README seção 6.3 |
| **Vitoria Barboza** | QA (testes e evidências) | Executa os casos de teste na Azure; **prints E2, CA3 (409), CA4**; organiza `evidencias/` | README seção 7, `test/`, `evidencias/README.md` |
| **Leonardo Silva** | QA (README e pitch) | Preenche URL e links no README; conduz o pitch; grava o vídeo (E6) | `README.md`, este guia |

## 2. Cronograma da noite

| Horário | Etapa | O que o G01 faz |
|---|---|---|
| 18h35 | Distribuição | Preencher a linha do grupo no painel: **Desafio 01, Nível A**, integrantes e papéis |
| 18h45 | Planejamento | **Renan já cria o Azure SQL** (leva minutos para ficar pronto) e o App Service. O resto ensaia o Ponto de controle 1 |
| **19h05** | **Ponto de controle 1** | Roteiro de 1 minuto (seção 3) |
| 19h05 | Sprint 1: persistência | Vinicius T. roda os scripts do banco; Renan configura `DATABASE_URL` e publica; Antonio e Lucas testam `/health` e o `.http` na URL |
| 19h55 | Palavra do dia | Cadastrar `G01-PALAVRA` **pela aplicação**, listar, conferir no Editor de consultas; o grupo vizinho anota no painel |
| **20h05** | **Ponto de controle 2** | Persistência comprovada (Prints 1, 2 e 4 já podem ser feitos) |
| 20h35 | **Reinício obrigatório** | Reiniciar o App Service; conferir `iniciado_em` novo e `G01-PALAVRA` ainda na lista (**Print 3**) |
| até 20h40 | URL no painel | Renan coloca a URL pública no painel |
| 20h40–21h10 | Teste do professor | O professor cadastra `PROF-HHMM` pela URL; Vitoria tira print da lista com esse registro |
| 20h35–21h20 | Sprint 2 | Vinicius T. roda `preparacao-teste-ca4.sql`; Vitoria faz os prints do CA4 e do 409; Renan faz o print E5; Leonardo atualiza o README |
| 21h20 | Código congelado | Nada de deploy novo depois disso |
| **21h30** | **Ponto de controle 3** + feira | Pitch de 90 s (seção 4). **Abram o `/health` 2 minutos antes**, para acordar o App Service e o banco |
| 21h52 | Fechamento | Nada cobra por hora (F1 + SQL gratuito). **Não apaguem o grupo de recursos**: a próxima aula ainda usa. Excluam só na data indicada pelo professor |

**Se o deploy atrasar:** às 19h55 dá para gravar o `G01-PALAVRA` rodando a aplicação no computador (`npm start`) com a `DATABASE_URL` apontando para o Azure SQL. O registro fica na nuvem do mesmo jeito. Depois sigam com o deploy.

**Regra dos 15 minutos:** travados na infraestrutura há 15 minutos? Desçam de nível, registrem o motivo no painel e sigam. Atenção: este código conecta **apenas em SQL Server/Azure SQL**. Se o banco do professor (Nível B) for PostgreSQL, o caminho é o Nível C (SQL Server local; README, seção 6.2).

## 3. Ponto de controle 1: roteiro de 1 minuto

1. **Problema e usuário** (Leonardo, 15 s): "A coordenação perde tarefas em post-its e grupos de mensagem e não sabe o que está atrasado. O usuário é o assistente acadêmico ou o coordenador, no computador da secretaria."
2. **Arquitetura** (Renan, 15 s), apontando o diagrama do README: "Navegador → HTTPS → App Service F1 com Node e Express → TLS na porta 1433 → firewall → Azure SQL Database gratuito. A string de conexão fica na variável `DATABASE_URL`."
3. **Modelo de dados** (Vinicius T., 15 s): "Uma tabela, `tarefas`. Título `NVARCHAR(120)` com `CHECK` de no mínimo 3 caracteres; prioridade com `CHECK IN ('baixa','media','alta')`; `prazo DATE NULL`; `concluida_em DATETIMEOFFSET NULL`. A situação não é coluna: é derivada de `concluida_em`."
4. **Rotas e quem faz o quê** (Antonio, 15 s): "`POST /api/tarefas`, `GET /api/tarefas?situacao=atrasadas`, `PATCH /api/tarefas/:id/concluir`, `DELETE /api/tarefas/:id` e `GET /health`. Papéis na tabela do README."

## 4. Pitch de 90 segundos

| Tempo | Quem | O que falar e mostrar |
|---|---|---|
| 0–15 s | Leonardo | "Somos o G01. A coordenação controla tarefas em post-its e grupos de mensagem: tarefas se perdem e ninguém sabe o que está atrasado. O Mural da Coordenação reúne cada tarefa com responsável, prazo e prioridade, e mostra na hora o que está atrasado." |
| 15–50 s | Lucas (demo) | Cadastrar uma tarefa. Tentar o título `ab` → "quem recusa é o **servidor**: 400 com mensagem". Concluir → "data e hora gravadas". Concluir de novo (segunda aba ou `.http`) → **409** "já foi concluída em…". Aba **Atrasadas** → "só a pendente com prazo vencido; a concluída, mesmo com prazo de ontem, não entra". |
| 50–65 s | Vinicius T. | "Este é o `G01-PALAVRA`. Reiniciamos o App Service, o `iniciado_em` mudou e o registro continua. Aqui está a mesma linha no Editor de consultas do Azure SQL, junto com o `PROF-HHMM` do professor." |
| 65–80 s | Renan | "Usamos App Service F1 com Node e Azure SQL Database na oferta gratuita, porque ele não cobra por hora. O custo é a pausa automática: depois de um tempo parado, o primeiro acesso responde 503 por cerca de um minuto, e o app reconecta sozinho, sem cair." |
| 80–90 s | Leonardo | "A dificuldade: um índice filtrado fazia as gravações falharem por uma configuração de sessão do SQL; trocamos por um índice comum. Ainda falta login e o Application Insights." |

Ensaiem com cronômetro. O vídeo (E6) pode ser a gravação desse mesmo roteiro; o link vai no topo do README.

## 5. Antes de cada print

- Deixem o **relógio do sistema** visível (data e hora). A tela também mostra "Agora (Brasília)".
- **Nunca** mostrem senha ou a `DATABASE_URL` aberta. Senha apareceu num print? Avisem o professor e troquem (`ALTER USER app_mural WITH PASSWORD = ...` + atualizar a variável no App Service).
- Salvem em `evidencias/` com os nomes de [`evidencias/README.md`](../evidencias/README.md).

## 6. Perguntas prováveis (todos devem saber responder)

| Pergunta | Resposta curta |
|---|---|
| Qual o caminho de uma requisição? | Navegador → HTTPS → App Service (contêiner Linux, Node na `PORT`) → Express: rota, validação, repositório → driver `mssql` com TLS na porta 1433 como `app_mural` → firewall do servidor SQL → banco `mural` → JSON de volta. |
| Onde fica a string de conexão? | Na variável `DATABASE_URL`: no App Service (Configurações > Variáveis de ambiente) e, no computador, no `.env`, que está no `.gitignore`. |
| Como garantem o 409? | Um único `UPDATE ... WHERE id = @id AND concluida_em IS NULL`. Se nenhuma linha muda, consultamos o id: não existe → 404; já concluída → 409. É atômico: com 5 cliques simultâneos, só 1 conclui (teste T8). |
| Por que "atrasada" não é uma coluna? | Porque depende do dia de hoje: como coluna, precisaria de uma rotina para virar o status à meia-noite. Derivada de `concluida_em` + prazo, ela muda sozinha e nunca fica inconsistente. |
| Qual "hoje" vocês usam? | O de Brasília. O App Service roda em UTC, e às 21h de Brasília já é o dia seguinte em UTC: uma tarefa com prazo de hoje apareceria como atrasada bem na hora da aula. |
| Como evitam SQL injection? | Todo valor entra como parâmetro (`@titulo`, `@responsavel`...), nunca concatenado. Testamos `x' OR 1=1 --` no filtro: lista vazia (T9). |
| E se o banco cair ou pausar? | A API responde 503 com mensagem amigável e `Retry-After`; o detalhe vai só para o log. Quando o banco volta, o app reconecta sem reiniciar (T10). |
| Por que o app não usa o administrador? | Menor privilégio: `app_mural` só lê e grava a tabela `tarefas`. Testamos `DROP TABLE` com ele: negado (T12). |
| Exclusão física ou lógica? | Física: mais simples e o dado some de fato. Perdemos lixeira e histórico; o próximo passo seria exclusão lógica. |
| Por que Azure SQL e não PostgreSQL? | A oferta gratuita não cobra por hora e é gerenciada. O trade-off é a pausa automática (cerca de 1 min para acordar) e o limite mensal. |
| Onde a validação acontece? | No servidor (`src/validacao.js`); o banco tem `CHECK`s como última linha de defesa. A tela usa `novalidate` justamente para mostrar a resposta 400 do servidor. |
| Por que o CA2 não é um `CHECK` no banco? | Um `CHECK (prazo >= hoje)` seria reavaliado em todo `UPDATE`, e concluir uma tarefa já atrasada falharia. A regra vale só no cadastro. |
