# finfy

Projeto de finanças pessoais: várias moedas (EUR e BRL), wallets compartilhadas, apps offline e tradução em inglês e português do Brasil. A web vem primeiro, em Next.js na Vercel.

O repositório também guarda a documentação de referência do app **Minhas Economias**, levantada por engenharia reversa do portal web.

## Onde está cada coisa

| Caminho | Conteúdo |
| --- | --- |
| `apps/web` | Next.js: páginas públicas, app logado (`/app`) e API |
| `packages/app` | Telas do app logado, sem depender do Next.js |
| `packages/ui` | Componentes shadcn no estilo macOS, copiados do image-resizer |
| `packages/shared` | Dinheiro, IDs, papéis, idiomas e esquema do banco (Drizzle) |
| `packages/env` | Variáveis de ambiente validadas |
| [`wiki/`](wiki/README.md) | Documentação: decisões, modelo de dados, código, referências |
| [`AGENTS.md`](AGENTS.md) | Instruções para agentes de IA (Claude Code, Codex, IA local) |

## Começar

```bash
pnpm install
pnpm dev
```

O site abre em http://localhost:3000. Comandos, banco local e regras de código estão em [`wiki/finfy/codebase.md`](wiki/finfy/codebase.md).

## Como trabalhar

Comece pelo [índice da wiki](wiki/README.md). Qualquer descoberta ou decisão vai para a wiki no mesmo commit, seguindo [`wiki/MANUTENCAO.md`](wiki/MANUTENCAO.md).
