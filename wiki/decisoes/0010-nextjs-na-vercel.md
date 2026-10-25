# 0010 — Web primeiro, em Next.js na Vercel, com a API dentro

> Status: Aceita · Decidido em 2026-10-25 (detalhes de banco, ORM e contrato da API em aberto)

## Contexto

A [0009](0009-react-tauri-capacitor.md) pôs todos os clientes em React, com três cascas: web, Tauri (Windows e macOS) e Capacitor (Android e iOS).

A pessoa definiu que:

1. **A primeira versão é a web.**
2. A web terá **páginas públicas**, como o Minhas Economias. Por isso SEO e renderização no servidor importam.
3. **O deploy será na Vercel**, como no image-resizer.

Também foi confirmado que é preciso uma API, que faz o que não pode ficar no aparelho:

- login, MFA e sessões ([0004](0004-seguranca-da-conta.md));
- `POST /api/sync/push`: valida permissão, mescla por campo e cria conflitos ([0005](0005-offline-first-e-sincronizacao.md));
- o token que o PowerSync exige para cada aparelho;
- convites por e-mail e transferência de posse ([0002](0002-wallets-e-compartilhamento.md), [0003](0003-convites-por-email.md));
- a auditoria ([0006](0006-auditoria.md));
- todas as leituras e escritas da web, que é só online.

Antes desta decisão foi considerado Vite com uma API separada. Isso foi trocado porque a web vem primeiro e precisa de páginas públicas.

## Decisão

### Web e API num app Next.js (`apps/web`)

| Parte | Como |
| --- | --- |
| Páginas públicas (início, preços, recursos, ajuda, blog) | Renderizadas no servidor ou estáticas, com metadados para SEO |
| App logado | Rotas em `/app/...`; as telas rodam no navegador e vêm de `packages/app` |
| API | *Route handlers* do Next.js em `/api/...`. É a mesma API que os apps nativos vão chamar por HTTPS |
| Deploy | **Vercel**. `main` vai para produção e as outras branches geram *preview*, como no image-resizer |

A API fica **dentro do Next.js** para começar. Se um dia precisar escalar ou rodar separada, as regras ficam em `packages/shared` e nos módulos de servidor, prontas para mudar de lugar.

### Apps nativos depois, sem reescrever telas

- As telas do app logado ficam em **`packages/app`**: React puro, sem importar nada do Next.js. Rotas, links e o acesso a dados entram por adaptadores. Isso evita reescrever as telas quando chegar a vez dos apps nativos.
- Quando chegar a vez do Tauri e do Capacitor, um build **Vite** do `packages/app` gera os arquivos estáticos para as duas cascas. O Next.js não é usado nelas.

### Estrutura do monorepo (pnpm)

| Pasta | O que é | Quando |
| --- | --- | --- |
| `apps/web` | Next.js: páginas públicas, app logado e API | Primeira versão |
| `packages/app` | Telas e rotas do app logado, sem Next.js | Primeira versão |
| `packages/ui` | Componentes, tokens e `globals.css` copiados do image-resizer ([0008](0008-linguagem-visual.md)) | Primeira versão |
| `packages/shared` | Esquemas zod, tipos e regras puras usados pelo cliente e pela API (dinheiro em `*_minor`, papéis, permissões) | Primeira versão |
| `packages/env` | Validação de variáveis de ambiente (t3-env + zod, como no image-resizer) | Primeira versão |
| `apps/native` | Build Vite do `packages/app` + cascas Tauri e Capacitor | Depois da web |

Os nomes das pastas podem mudar na criação do projeto. Se mudarem, atualize esta tabela.

### Tarefas em segundo plano

O envio de e-mails (convites, segurança), a geração de recorrências e as limpezas não podem depender de alguém estar com a página aberta. Elas usam **Vercel Cron** para as tarefas agendadas e fila (**Vercel Queues** ou a tabela `email_outbox` lida pelo cron) para as tarefas por evento.

### Limites da Vercel a respeitar

- As funções recebem corpos de até 4,5 MB, mesmo limite visto no image-resizer. Anexos (comprovantes) devem ir direto para um armazenamento de arquivos (ex.: Vercel Blob) com upload pelo cliente, sem passar pela função.
- As funções não guardam estado entre requisições. Sessão, limites de tentativas (*rate limiting*) e filas ficam no banco ou num serviço próprio.

## Consequências

- Um só projeto na Vercel para o site, o app web e a API.
- O PowerSync não roda na Vercel. Ele será o serviço hospedado (PowerSync Cloud) ou rodará em outro servidor. Isso só importa quando os apps nativos começarem; a web não usa PowerSync.
- O Postgres precisa aceitar **replicação lógica** para o PowerSync ler as mudanças. Isso deve ser conferido ao escolher o provedor.

## Perguntas em aberto

- [ ] Provedor do Postgres. Ex.: Neon, pela Vercel Marketplace. Precisa ter replicação lógica para o PowerSync.
- [ ] Acesso ao banco: **Drizzle** (o que o my-fin usa) ou Kysely.
- [ ] Contrato entre cliente e API: REST com esquemas zod compartilhados, tRPC ou OpenAPI gerado.
- [ ] Gerenciamento de dados no cliente (ex.: TanStack Query).
- [ ] Quais páginas públicas existem na primeira versão.
- [ ] Provedor de e-mail ([0003](0003-convites-por-email.md)).
