# Evidências: G01 · Mural da Coordenação

Prints com **data e hora visíveis** (relógio do sistema na barra de tarefas; a tela também mostra "Agora (Brasília)"). **Nunca** mostrem senha nem a `DATABASE_URL` aberta.

| Arquivo | O que mostrar | Responsável | Feito |
|---|---|---|---|
| `E1-url-publica.png` | Navegador com a URL pública (`https://app-cloud-g01-...azurewebsites.net`) aberta e funcionando | Renan | ☐ |
| `E2-1-listagem-G01-PALAVRA.png` | **Print 1:** lista da aplicação com o registro `G01-PALAVRA` | Vitoria | ☐ |
| `E2-2-health-antes.png` | **Print 2:** `/health` com o `iniciado_em` (antes do reinício) | Vitoria | ☐ |
| `E2-3-health-depois-e-lista.png` | **Print 3:** depois do reinício, `iniciado_em` diferente e `G01-PALAVRA` ainda listado | Vitoria | ☐ |
| `E2-4-consulta-direta-banco.png` | **Print 4:** Editor de consultas com a mesma linha (consulta 1 de `banco/consultas-evidencia.sql`) | Vinicius T. | ☐ |
| `E3-casos-de-teste-azure.png` | Respostas do `requisicoes.http` na URL pública (`400`, `404`, `409`...) | Vitoria | ☐ |
| `CA3-409-concluir-de-novo.png` | Resposta `409` ao concluir a mesma tarefa pela 2ª vez | Vitoria | ☐ |
| `CA4-filtro-atrasadas.png` | Aba **Atrasadas** mostrando só a pendente com prazo de ontem (depois de `preparacao-teste-ca4.sql`) | Vitoria | ☐ |
| `E5-variaveis-ocultas.png` | App Service > Variáveis de ambiente com o valor da `DATABASE_URL` **oculto** | Renan | ☐ |
| `E5-gitignore-env.png` | Arquivo `.gitignore` mostrando a linha `.env` | Renan | ☐ |
| `PROF-HHMM.png` | Registro `PROF-HHMM` cadastrado pelo professor, na lista | Vitoria | ☐ |

Já incluído:
- `E3-testes-automatizados-execucao-local.txt`: saída real do `npm test` (33 testes) na execução **local** de 03/11/2026, com SQL Server 2022 em contêiner. Para ter o mesmo registro na Azure, coloquem a `DATABASE_URL` do Azure SQL no `.env` e rodem `npm test > evidencias/E3-testes-automatizados-azure.txt` (os testes apagam o que criam).
