# G01 · Como o projeto foi construído: 6 partes, 1 commit por integrante

A aplicação foi dividida em 6 partes. Cada integrante fez o commit de uma parte, **nesta ordem**. A ordem garante que o código funciona depois de cada commit: nenhum commit deixa o projeto quebrado.

| Ordem | Integrante | Papel | O que entrou no commit | Depois deste commit... |
|---|---|---|---|---|
| 1 | Antonio Vinicius | NUVEM: banco Azure SQL | `banco/schema.sql`, `banco/usuario-app.sql`, `.env.example`, `.gitignore` | Banco criado na Azure com tabela e usuário sem privilégio; `.env` protegido |
| 2 | Renan Souza | NUVEM: App Service e deploy | `package.json`, `package-lock.json`, `src/server.js`, `src/app.js`, `src/banco.js`, `src/erros.js`, `src/datas.js`, `.vscode/` | `npm start` sobe o servidor; `/health` testa o banco |
| 3 | Vinicius Trezena | DADOS | `src/repositorio-tarefas.js`, `banco/preparacao-teste-ca4.sql`, `banco/consultas-evidencia.sql` | Todo o SQL da aplicação pronto (ainda não ligado às rotas) |
| 4 | Lucas Vinicius | DEV: API e interface | `src/validacao.js`, `src/rotas-tarefas.js`, `src/app.js`, `public/`, `requisicoes.http` | Aplicação completa: tela, API, regras CA1–CA5 |
| 5 | Vitoria Barboza | QA: testes e evidências | `test/`, `package.json` (scripts de teste), `evidencias/` | `npm test` roda 33 testes |
| 6 | Leonardo Silva | QA: README e pitch | `README.md`, `docs/` | Documentação completa |

## Como cada integrante fez o commit

1. Aceitar o convite de colaborador do repositório (chega por e-mail).
2. Clonar o repositório, ou atualizar quem já tinha clonado:

   ```bash
   git clone https://github.com/Antonio-avsp/Cloud_challenge.git
   ```

   ```bash
   cd Cloud_challenge
   ```

   ```bash
   git pull
   ```

3. Configurar o Git com o **próprio** nome e o e-mail da **própria** conta do GitHub (senão o commit não conta para a pessoa):

   ```bash
   git config user.name "Seu Nome"
   ```

   ```bash
   git config user.email "seu-email-do-github@exemplo.com"
   ```

4. Copiar o conteúdo da pasta `arquivos/` da sua parte para dentro da pasta `Cloud_challenge`, substituindo o que já existir.
5. Fazer o commit e enviar (a mensagem está no `LEIA-ME` de cada parte):

   ```bash
   git add -A
   ```

   ```bash
   git commit -m "feat: ..."
   ```

   ```bash
   git push
   ```

Sempre `git pull` antes, e **um de cada vez, na ordem**: só comece quando o commit anterior aparecer no GitHub.

## Deploy na Azure (depois dos 6 commits)

O banco já existe: servidor `sql-cloud-g01-avp`, banco `mural`, região **South Africa North**. O App Service precisa ficar na **mesma região**.

1. **Criar o App Service:** Portal > **App Services** > **Create > Web App**.
   - Resource group: `rg-cloud-g01` · Name: `app-cloud-g01-avp` (se já existir, acrescente um número).
   - Publish: **Code** · Runtime stack: **Node 22 LTS** · Operating System: **Linux** · Region: **South Africa North**.
   - Pricing plan: crie `plan-cloud-g01` com **Free F1**.
   - Aba **Deployment:** **Basic authentication = Enable**.
   - Aba **Monitoring:** Application Insights = **No**.
   - **Review + create > Create**.
2. **Variáveis de ambiente:** App Service > **Settings > Environment variables > App settings > + Add**:
   - `DATABASE_URL` = a string de conexão com o usuário `app_mural`, **sem aspas**;
   - `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`;
   - **Apply** e confirme.
3. **Publicar pelo GitHub:** **Deployment > Deployment Center**.
   - Source: **GitHub** (conta do Antonio) · Organization: `Antonio-avsp` · Repository: `Cloud_challenge` · Branch: **`main`**.
   - Authentication type: **Basic authentication** · **Save**.
   - A Azure cria um fluxo do GitHub Actions no repositório. Acompanhe na aba **Actions** do GitHub até ficar verde. A partir daí, todo commit na `main` publica sozinho.
4. **Conferir:** `https://app-cloud-g01-avp.azurewebsites.net/health` deve mostrar `"banco": "conectado"`. A primeira abertura pode levar até 1 minuto, porque o F1 e o banco gratuito "acordam".
5. **Logs:** **Monitoring > App Service logs > Application logging: File System > Save**, e depois **Log stream**.

Se o `/health` der 503, veja o Log stream. As causas mais comuns são a `DATABASE_URL` com aspas ou senha errada, ou o firewall do servidor SQL sem **Allow Azure services** marcado.
