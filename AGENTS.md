# AGENTS.md

Instruções para qualquer agente de IA que trabalhe neste repositório: Claude Code, Codex, IAs locais ou outros. Este arquivo é a fonte única; `CLAUDE.md` apenas aponta para cá.

## O que é este projeto

**finfy** é um projeto de finanças pessoais. O repositório contém:

- a documentação de referência do app **Minhas Economias**, obtida por engenharia reversa do portal web, em [`wiki/`](wiki/README.md);
- as decisões do próprio finfy em [`wiki/decisoes/`](wiki/decisoes/README.md): várias moedas (EUR e BRL), várias wallets por usuário com compartilhamento, papéis e transferência de posse, convites por e-mail, segurança da conta, offline-first com sincronização e auditoria;
- a análise do **Wallefy** (projeto `my-fin`), usado como base para wallets, convites e segurança, em [`wiki/referencias/wallefy.md`](wiki/referencias/wallefy.md).

Já decidido sobre a stack:

- Clientes em **React + TypeScript, com shadcn/ui e Tailwind v4**: web só online; **Tauri** para Windows e macOS; **Capacitor** para Android e iOS. Os apps nativos funcionam offline ([0009](wiki/decisoes/0009-react-tauri-capacitor.md)). A [0007](wiki/decisoes/0007-flutter-nos-clientes.md) (Flutter) foi substituída: não use Flutter.
- Interface igual à do projeto **image-resizer** (`D:\projetos\image-resizer`): mesmo `packages/ui`, tokens, estilo macOS e princípios Apple ([0008](wiki/decisoes/0008-linguagem-visual.md)).
- **Traduções em pt-BR e en** desde o início (pt-PT depois). Nenhum texto fixo nas telas, API ou e-mails; a API devolve códigos e o cliente traduz ([0011](wiki/decisoes/0011-traducoes.md)).
- Banco com **Drizzle ORM**. O esquema já segue as regras de sincronização ([data-model.md → Sync-ready schema rules](wiki/finfy/data-model.md#sync-ready-schema-rules)), mesmo antes dos apps nativos. A web usa o mesmo caminho de escrita que o `push` dos apps.
- Sincronização com **PowerSync + Postgres**, com toda escrita passando pela API do finfy ([0005](wiki/decisoes/0005-offline-first-e-sincronizacao.md)).
- **Web primeiro**, em **Next.js na Vercel**: páginas públicas, app logado (`/app`) e API (*route handlers*) no mesmo app. As telas do app logado ficam em `packages/app`, sem depender do Next.js, para serem reaproveitadas depois no Tauri e no Capacitor por um build Vite ([0010](wiki/decisoes/0010-nextjs-na-vercel.md)).

Decisões com status "Proposta" têm perguntas em aberto; não as trate como fechadas. O que ainda não foi decidido não deve ser inventado: pergunte.

## Código

O código começou (marco 1: base). Estrutura, comandos e regras de código estão em [`wiki/finfy/codebase.md`](wiki/finfy/codebase.md), em inglês. Leia antes de mexer no código. O essencial:

- Monorepo pnpm: `apps/web` (Next.js), `packages/app` (telas, **sem importar Next.js**), `packages/ui` (cópia do image-resizer), `packages/shared` (dinheiro, IDs, papéis, idiomas, esquema Drizzle), `packages/env`.
- Antes de commitar, rode `pnpm typecheck`, `pnpm test`, `pnpm check:messages` e `pnpm check:openapi`. No PowerShell, use `pnpm.cmd`.
- Toda rota nova da API é descrita em `apps/web/lib/openapi.ts` (Swagger em `/api/docs`, só em desenvolvimento); depois rode `pnpm openapi`.
- Texto novo vai nos dois arquivos de mensagens (`packages/shared/src/i18n/messages/en.json` e `pt-BR.json`).
- Mudança no esquema: `pnpm db:generate`, commitar a migração e seguir as regras de sincronização.
- Código, comentários e identificadores em inglês; a interface em pt-BR e en.

## Onde fica cada modelo de dados

- **finfy:** [`wiki/finfy/data-model.md`](wiki/finfy/data-model.md), em inglês. É o modelo a seguir no código. Todo ele foi aprovado em 2026-10-25 e já tem tabelas no banco.
- **Minhas Economias (referência):** [`wiki/api/modelo-de-dados.md`](wiki/api/modelo-de-dados.md). Não use como modelo do finfy.
- Ao mudar uma decisão que afete tabelas, atualize o `data-model.md` no mesmo trabalho.

## Antes de começar qualquer tarefa

1. Leia [`wiki/README.md`](wiki/README.md) (índice) e a página da funcionalidade envolvida.
2. Para dúvidas de API, use [`wiki/api/endpoints.md`](wiki/api/endpoints.md), [`wiki/api/payloads.md`](wiki/api/payloads.md) e [`wiki/api/modelo-de-dados.md`](wiki/api/modelo-de-dados.md).
3. Veja [`wiki/problemas-encontrados.md`](wiki/problemas-encontrados.md) para não repetir os erros do app de referência.
4. Veja [`wiki/pendencias.md`](wiki/pendencias.md) para saber o que ainda não é conhecido.

## Manter o contexto atualizado (obrigatório)

Este repositório é usado por agentes diferentes, que não compartilham memória. O único contexto comum é o que está escrito aqui. Por isso:

- Toda descoberta, decisão ou mudança de comportamento entra na wiki **no mesmo trabalho** que a gerou, seguindo [`wiki/MANUTENCAO.md`](wiki/MANUTENCAO.md).
- Decisões de produto ou de arquitetura do finfy entram em [`wiki/decisoes/`](wiki/decisoes/README.md), um arquivo numerado por decisão, com status, e no índice. Quando uma pergunta em aberto for respondida, atualize a decisão e o status.
- Atualize a data "Última atualização" das páginas que mudar e do índice.
- Se algo na wiki estiver errado, corrija; não deixe duas versões.
- Ao terminar, o resumo para a pessoa deve dizer quais páginas da wiki mudaram.

## Convenções

- Idioma: português do Brasil, frases curtas. Exceção: a documentação técnica do finfy em `wiki/finfy/` (modelo de dados e o que vier a seguir) é em inglês.
- Markdown simples, tabelas para listas comparáveis, nomes de API em `código` exatamente como aparecem.
- Commits pequenos e descritivos, em português, no formato `tipo: descrição` (ex.: `docs: documenta ciclo da fatura`).

## Segurança e dados

- Nunca grave no repositório tokens, cookies, senhas, CPF, nomes reais, e-mails ou UUIDs de contas reais. Use marcadores (`{uuidAccount}`).
- Testes no app real só na conta de teste, com itens prefixados `[TESTE]`, registrados em [`wiki/testes/dados-de-teste.md`](wiki/testes/dados-de-teste.md).
- No app real, **botões de apagar agem sem confirmação**. Não apague nada sem pedido explícito.
- Não conecte bancos reais, não migre dados da versão antiga e não altere senha nem conta.
