# G01 · Deploy e um commit por integrante

O código está pronto e o banco já existe na Azure (`sql-cloud-g01-avp` / banco `mural`, região **South Africa North**). Falta publicar o app e fazer com que **cada integrante faça pelo menos 1 commit**. Cada tarefa abaixo é uma entrega real do projeto, ligada ao papel da pessoa.

## Divisão atualizada

O Antonio criou o banco na Azure, então assumiu a parte de banco na nuvem. O Renan fica com o App Service e o deploy.

| Integrante | Papel | Commit dele |
|---|---|---|
| Antonio Vinicius | NUVEM: banco (Azure SQL) | 1. Dados reais do Azure SQL e papéis atualizados no README |
| Renan Souza | NUVEM: App Service e deploy | 2. URL pública + prints E1 e E5 |
| Lucas Vinicius | DEV: interface e requisições | 3. `requisicoes.http` apontando para a URL pública + print do 409 (CA3) |
| Vinicius Trezena | DADOS | 4. Prints da prova de persistência no banco (Print 4) e do CA4 |
| Vitoria Barboza | QA: testes e evidências | 5. `npm test` na Azure + coluna "Obtido (Azure)" no README |
| Leonardo Silva | QA: README e pitch | 6. Link do vídeo do pitch + guia do grupo atualizado |

## Antes de tudo (Antonio, 5 min)

1. **Branch `main`:** o projeto já está na branch **`main`**; todo mundo trabalha nela.
2. **Colaboradores:** em **Settings > Collaborators > Add people**, convide os outros 5 pelo usuário do GitHub. Cada um precisa **aceitar o convite** (chega por e-mail).
3. Quem já tinha clonado roda:

   ```bash
   git fetch origin
   ```

   ```bash
   git checkout main
   ```

## Como cada um faz o commit

Escolha o jeito mais fácil para você. O commit precisa sair **da sua conta do GitHub**, não da de outra pessoa.

**Pelo site do GitHub (sem instalar nada):**
- Abra o repositório e clique no arquivo; para editar, clique no lápis. Ao terminar, clique em **Commit changes**.
- Para enviar prints: entre na pasta `evidencias/` e clique em **Add file > Upload files**.

**Pelo computador** (Git configurado com o **seu** nome e e-mail):

```bash
git pull
```

Faça a alteração, e depois:

```bash
git add .
```

```bash
git commit -m "mensagem do seu commit"
```

```bash
git push
```

Façam **um de cada vez** e sempre um `git pull` antes, para não dar conflito. Ordem sugerida: 1 → 6.

---

## Deploy (Renan, com o Antonio ao lado)

O App Service precisa ficar na **mesma região do banco: South Africa North**.

1. **Criar o App Service:** Portal > **App Services** > **Create > Web App**.
   - Resource group: `rg-cloud-g01` · Name: `app-cloud-g01-avp` (se existir, acrescente um número).
   - Publish: **Code** · Runtime stack: **Node 22 LTS** · Operating System: **Linux** · Region: **South Africa North**.
   - Pricing plan: crie `plan-cloud-g01` com **Free F1**.
   - Aba **Deployment:** se aparecer **Basic authentication**, deixe **Enable** (o deploy pelo GitHub usa isso).
   - Aba **Monitoring:** Application Insights = **No**.
   - **Review + create > Create**.
   - Se a região não aceitar o F1, me avisem antes de escolher outro plano: **plano pago só com autorização do professor**.
2. **Variáveis de ambiente:** abra o App Service > **Settings > Environment variables > App settings > + Add**:
   - `DATABASE_URL` = a mesma linha do `.env` do Antonio, **sem as aspas** (o Antonio passa por mensagem privada, nunca pelo grupo aberto).
   - `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`.
   - Clique em **Apply** e confirme.
3. **Publicar pelo GitHub:** **Deployment > Deployment Center**.
   - Source: **GitHub** · faça login com a conta do **Antonio** (dono do repositório) · Organization: `Antonio-avsp` · Repository: `Cloud_challenge` · Branch: **`main`**.
   - Authentication: **Basic authentication** · **Save**.
   - A Azure cria um GitHub Actions no repositório (isso gera um commit automático). A partir daí, **cada commit na `main` publica o app sozinho** (dá para acompanhar na aba **Actions** do GitHub).
4. **Conferir:** abra `https://app-cloud-g01-avp.azurewebsites.net/health` (troque pelo nome real). O esperado é `"banco": "conectado"`. A primeira abertura pode levar até 1 minuto, porque o F1 e o banco gratuito "acordam".
5. **Logs:** **Monitoring > App Service logs > Application logging: File System > Save**, e depois **Log stream**.

Se o `/health` der 503, olhem o Log stream. As causas mais comuns são `DATABASE_URL` com aspas ou senha errada, ou o firewall do servidor sem **Allow Azure services** marcado.

---

## Os 6 commits

### 1. Antonio Vinicius: dados reais do Azure SQL e papéis no README
- Em `README.md`:
  - na tabela de integrantes, troque o papel do Antonio para **NUVEM (banco Azure SQL)** e o do Renan para **NUVEM (App Service e deploy)**;
  - na seção **6.3**, onde está `sql-cloud-g01-SUFIXO`, troque por **`sql-cloud-g01-avp`**;
  - na seção **6.3**, onde está "Região: `brazilsouth`...", troque por: "Região usada: **South Africa North** (a política da assinatura Azure for Students não permitiu o Brasil)".
- **Nunca** coloque senha no README.
- Mensagem: `Azure SQL criado: servidor, região e papéis atualizados`

### 2. Renan Souza: URL pública e evidências da nuvem
- Depois do deploy, no `README.md`, no topo, troque `https://app-cloud-g01-SUFIXO.azurewebsites.net` pela URL real.
- Tire dois prints com o relógio do computador visível e envie para `evidencias/`:
  - `E1-url-publica.png`: o site aberto na URL pública;
  - `E5-variaveis-ocultas.png`: a tela de Environment variables com o valor da `DATABASE_URL` **oculto**.
- Mensagem: `Deploy no App Service: URL publica e evidencias E1/E5`

### 3. Lucas Vinicius: requisições na nuvem e teste do 409
- Em `requisicoes.http`, no topo:
  - comente a linha `@base = http://localhost:3000` (coloque `# ` na frente);
  - descomente a linha do Azure, trocando pela URL real.
- No VS Code com a extensão REST Client, rode as requisições 2, 10 e 11 (cadastrar, concluir, concluir de novo).
- Tire print da resposta **409** e salve como `evidencias/CA3-409-concluir-de-novo.png`.
- Mensagem: `requisicoes.http aponta para a Azure + print do CA3 (409)`

### 4. Vinicius Trezena: prova no banco e CA4
- No Editor de consultas do banco `mural` (login `adm_g01`):
  - rode `banco/preparacao-teste-ca4.sql`;
  - rode a consulta 1 de `banco/consultas-evidencia.sql`, depois que o `G01-PALAVRA` existir.
- Envie para `evidencias/`:
  - `E2-4-consulta-direta-banco.png`: a linha `G01-PALAVRA` no Editor de consultas;
  - `CA4-filtro-atrasadas.png`: no site, a aba **Atrasadas** mostrando só a "CA4 - pendente com prazo de ontem".
- Mensagem: `Prova de persistencia no banco (Print 4) e CA4`

### 5. Vitoria Barboza: testes contra a Azure
- No computador, com o `.env` apontando para o Azure SQL (peça a linha ao Antonio em mensagem privada), rode:

  ```bash
  npm test > evidencias/E3-testes-automatizados-azure.txt
  ```

  O arquivo precisa terminar com `pass 33` e `fail 0`. Os testes apagam o que criam.
- Envie também os Prints 1, 2 e 3 da prova de persistência para `evidencias/`:
  - `E2-1-listagem-G01-PALAVRA.png`;
  - `E2-2-health-antes.png`;
  - `E2-3-health-depois-e-lista.png`.
- No `README.md`, seção **7**, no parágrafo acima da tabela, acrescente: "Repetido na Azure em DD/MM/AAAA: 33 de 33 testes passando (`evidencias/E3-testes-automatizados-azure.txt`)".
- Mensagem: `Testes na Azure (33/33) e prints da prova de persistencia`

### 6. Leonardo Silva: pitch e guia
- Grave o pitch de 90 s (roteiro na seção 4 de `docs/guia-do-grupo.md`), suba no YouTube (não listado) ou no Drive com link aberto.
- No `README.md`, no topo, troque *adicionar o link* pelo link do vídeo.
- Em `docs/guia-do-grupo.md`, na tabela "Quem faz o quê", atualize os papéis do Antonio e do Renan como na tabela do início deste arquivo.
- Mensagem: `Link do pitch e guia do grupo com papeis atualizados`

## Conferência final (Leonardo)
- No GitHub, abra **Insights > Contributors**, ou a lista de commits: os 6 nomes precisam aparecer.
- Em `evidencias/README.md`, marque ☑ cada print entregue.
