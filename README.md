# Checklist

Aplicação de tarefas com subtarefas em formato de checklist. Cada tarefa aparece em um card que pode ser aberto para edição ou recolhido para mostrar o título e o progresso.

O projeto começou como um exercício de HTML, CSS e JavaScript e evoluiu para uma aplicação com API REST e persistência em PostgreSQL no Supabase. A proposta é aprender o desenvolvimento completo de uma aplicação, mantendo o código organizado em módulos e sem frameworks de frontend.

## Estado atual

O frontend e o servidor são executados localmente, e os dados podem ser armazenados no PostgreSQL hospedado no Supabase. A conexão com o banco já foi validada no ambiente de desenvolvimento.

**Ainda não há login, separação de dados por usuário, compartilhamento com permissões ou deploy do site.** Nesta etapa, a aplicação trabalha com uma única lista de tarefas. O banco online, por si só, não torna o site acessível pela internet.

## Funcionalidades

- Criar e renomear tarefas.
- Exibir cards em duas colunas em telas maiores e uma coluna em telas menores.
- Abrir um card por vez; uma nova tarefa recebe foco no campo de subtarefa.
- Criar subtarefas, marcar e desmarcar a conclusão.
- Mostrar quantidade de subtarefas concluídas e barra de progresso.
- Excluir tarefas e subtarefas com confirmação.
- Salvar no servidor e preservar os dados após recarregar a página ou reiniciar o servidor.
- Mostrar erros quando uma operação não pode ser salva.
- Consultar novamente o banco pelo botão **Reload**.
- Importar tarefas da versão antiga, armazenadas no localStorage, preservando o backup original.

A API também permite editar o texto de uma subtarefa; essa ação ainda não tem controle próprio na interface.

## Stack

| Camada | Tecnologias | Papel no projeto |
| --- | --- | --- |
| Frontend | HTML5, CSS3, JavaScript | Estrutura, tema escuro, layout responsivo e interação |
| Módulos | ES Modules | Organização do código com import e export, no navegador e no Node.js |
| Comunicação | Fetch API, HTTP, JSON | Requisições do navegador à API REST |
| Backend | Node.js 22, Express 5 | Servidor de arquivos estáticos, rotas e validação |
| Banco de dados | PostgreSQL, Supabase | Persistência relacional hospedada |
| Driver | pg (node-postgres) | Pool de conexões, consultas parametrizadas e transações |
| Configuração | dotenv | Carregamento das variáveis do arquivo .env |
| Conexão segura | TLS e certificado CA | Validação do certificado do banco remoto |
| Testes | Jest 30, Supertest | Testes da API, comportamento dos cards e integração com PostgreSQL |
| Versionamento | Git, GitHub | Histórico e publicação do código |
| Ambiente de desenvolvimento | Windows, PowerShell, npm | Execução e gerenciamento de dependências |

As versões das dependências estão em [package.json](package.json); o [package-lock.json](package-lock.json) registra as versões resolvidas. Não são utilizados React, Next.js, TypeScript ou ORM.

## Como funciona

1. O navegador carrega os arquivos da pasta public servidos pelo Express.
2. O JavaScript consulta a API e renderiza as tarefas em cards.
3. Cada criação, alteração ou exclusão envia uma requisição ao backend.
4. O Express valida os dados e executa a operação no PostgreSQL.
5. A interface confirma a alteração após receber uma resposta de sucesso.

As credenciais do banco ficam no servidor. O navegador não recebe a URL de conexão nem a senha. O localStorage é usado para importar o backup da versão anterior, não como armazenamento principal das novas tarefas.

## Executar localmente

### Pré-requisitos

- Node.js 22 e npm.
- Git, para clonar o repositório.
- Um projeto Supabase com PostgreSQL, ou um banco PostgreSQL local.
- Credenciais de acesso ao banco.

### 1. Instalar

No PowerShell:

~~~powershell
git clone https://github.com/MirielBueno/checkList.git
cd checkList
npm.cmd ci
~~~

Os comandos usam npm.cmd para funcionar também em ambientes Windows que bloqueiam scripts npm.ps1. Em outros sistemas, use npm.

### 2. Configurar o ambiente

Se ainda não houver um arquivo .env:

~~~powershell
Copy-Item .env.example .env
~~~

Edite o arquivo .env:

~~~dotenv
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/postgres
PORT=3000
HOST=127.0.0.1
DATABASE_CA_FILE=./prod-ca-2021.crt
~~~

Esse endereço é ilustrativo. Use a URI real do seu banco.

| Variável | Descrição |
| --- | --- |
| DATABASE_URL | URI de conexão do PostgreSQL, incluindo usuário, senha, servidor, porta e banco |
| PORT | Porta HTTP da aplicação; padrão 3000 |
| HOST | Endereço em que o servidor escuta; padrão 127.0.0.1 |
| DATABASE_CA_FILE | Caminho para o certificado CA do provedor, quando necessário |

No Supabase:

1. Abra o projeto e clique em **Connect**.
2. Escolha **Direct — Connection string**, depois **Session pooler** em **Connection Method**, mantendo **Type: URI**.
3. Copie a connection string para DATABASE_URL e substitua o marcador de senha pela senha do banco.
4. Se a senha tiver caracteres reservados de URL, codifique esses caracteres.
5. Em **Database Settings → SSL Configuration**, baixe o certificado CA quando necessário. Salve-o localmente e ajuste DATABASE_CA_FILE ao nome do arquivo.

O backend valida o certificado nas conexões remotas. Para PostgreSQL local, DATABASE_CA_FILE pode ficar vazio. A configuração atual usa conexão sem TLS apenas para hosts de loopback.

O .env e o certificado baixado para o ambiente local não são enviados ao GitHub. O .env.example contém somente um modelo sem credenciais.

Referências: [conexão ao PostgreSQL no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) e [certificados SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).

### 3. Criar as tabelas

~~~powershell
npm.cmd run db:init
~~~

O comando cria o schema checklist e suas tabelas, caso ainda não existam. Ele não remove os dados existentes e não substitui um sistema de migrações para futuras alterações de schema.

### 4. Iniciar o servidor

~~~powershell
npm.cmd start
~~~

Abra **http://localhost:3000** e mantenha o terminal aberto. Para reiniciar automaticamente quando arquivos do servidor mudarem:

~~~powershell
npm.cmd run dev
~~~

### 5. Importar tarefas antigas

Se houver tarefas da versão anterior nesse navegador, clique em **Import saved tasks**.

Use o mesmo endereço em que os dados foram criados: localhost e 127.0.0.1 têm armazenamentos locais separados. A importação preserva o backup e usa um identificador de lote para evitar duplicações quando a mesma importação é repetida. Cada lote é salvo em uma transação.

## Organização dos arquivos

~~~text
checkList/
├── app.js                 # Rotas, validação e tratamento de erros HTTP
├── server.js              # Inicialização do servidor e conexão com o banco
├── db/
│   ├── pool.js            # Configuração da conexão PostgreSQL
│   ├── schema.sql         # Estrutura das tabelas
│   ├── init.js            # Preparação do banco
│   └── repository.js      # Consultas SQL e transações
├── public/
│   ├── index.html         # Página principal
│   ├── style.css          # Tema e layout
│   ├── script.js          # Inicialização, carregamento e criação de tarefas
│   ├── tasks.js           # Cards, subtarefas e eventos
│   ├── api.js             # Requisições HTTP
│   └── storage.js         # Acesso ao backup local da versão anterior
├── tests/
│   ├── api.test.js         # Rotas e validação com Supertest
│   ├── cards.test.js       # Comportamento dos cards com DOM simulado
│   └── database.test.js    # Integração com PostgreSQL
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json
~~~

## Modelo de dados

As tabelas ficam no schema checklist:

| Tabela | Campos principais | Finalidade |
| --- | --- | --- |
| tasks | id, title, created_at | Tarefas principais |
| subtasks | id, task_id, text, completed, created_at | Itens de checklist de cada tarefa |
| imports | id, created_at | Registro dos lotes importados |

Os IDs são UUIDs. Cada subtarefa pertence a uma tarefa, e a exclusão de uma tarefa remove suas subtarefas por chave estrangeira com ON DELETE CASCADE. As consultas usam parâmetros separados do SQL.

As tabelas têm Row Level Security habilitada e não possuem políticas para acesso público. A conexão administrativa do backend não representa autorização por usuário; essa separação será implementada junto ao login.

## API REST

| Método | Rota | Operação |
| --- | --- | --- |
| GET | /api/health | Verificar acesso do backend ao banco |
| GET | /api/tasks | Listar tarefas com subtarefas |
| POST | /api/tasks | Criar tarefa: title |
| PATCH | /api/tasks/:id | Renomear tarefa: title |
| DELETE | /api/tasks/:id | Excluir tarefa e suas subtarefas |
| POST | /api/tasks/:id/subtasks | Criar subtarefa: text |
| PATCH | /api/tasks/:id/subtasks/:subtaskId | Atualizar text e/ou completed |
| DELETE | /api/tasks/:id/subtasks/:subtaskId | Excluir subtarefa |
| POST | /api/import | Importar lote: id e tasks |

Corpos de requisições usam JSON. Títulos aceitam até 200 caracteres e textos de subtarefas até 500, após remover espaços nas extremidades. O corpo HTTP tem limite de 1 MB.

Respostas principais: 200 para consultas/atualizações, 201 para criação, 204 para exclusão, 400 para dados inválidos, 404 para recursos inexistentes, 413 para corpo excedido e 503 para falhas internas ou indisponibilidade do banco. A API não devolve credenciais nem detalhes internos do erro.

## Testes

~~~powershell
npm.cmd test
~~~

Os testes de API e cards não precisam de conexão ao Supabase. Eles cobrem validação, respostas HTTP, preservação da interface em caso de falha, foco e confirmações de exclusão.

O teste de integração com PostgreSQL só é executado quando TEST_DATABASE_URL está definida. **Use exclusivamente um banco descartável de testes**, pois ele cria tabelas e grava/remove registros:

~~~powershell
$env:TEST_DATABASE_URL = "postgresql://USUARIO:SENHA@localhost:5432/checklist_test"
npm.cmd test
Remove-Item Env:TEST_DATABASE_URL
~~~

A suíte completa foi verificada com 13 testes passando em uma instância temporária de PostgreSQL. Sem TEST_DATABASE_URL, o teste de banco é marcado como ignorado. Os testes dos cards usam um DOM simulado e não substituem a inspeção visual no navegador.

## Próximas etapas

- Cadastro e login, incluindo a possibilidade de entrar com Google.
- Associação de tarefas aos usuários e regras de acesso.
- Compartilhamento de tarefas com outras pessoas.
- Atualização das marcações entre participantes.
- Edição de textos de subtarefas pela interface.
- Deploy da aplicação e acesso pela internet.

A API atual ainda não autentica usuários. Mantenha-a local até implementar autenticação e autorização antes do deploy público.
