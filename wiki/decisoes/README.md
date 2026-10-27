# Decisões do finfy

> Última atualização: 2026-10-27

Cada decisão de produto ou arquitetura do finfy fica num arquivo próprio, numerado, para que qualquer agente saiba o que já foi decidido e por quê.

| # | Decisão | Status |
| --- | --- | --- |
| [0001](0001-multimoeda.md) | Várias moedas (EUR e BRL) | Proposta |
| [0002](0002-wallets-e-compartilhamento.md) | Wallets, papéis, compartilhamento e transferência de posse | Proposta |
| [0003](0003-convites-por-email.md) | Convites para wallets por e-mail | Proposta |
| [0004](0004-seguranca-da-conta.md) | Segurança da conta (senha, MFA, sessões) | Proposta |
| [0005](0005-offline-first-e-sincronizacao.md) | Offline-first e sincronização: apps nativos offline, web online, PowerSync + Postgres com escrita pela API | Proposta (plataformas e tecnologia de sincronização já decididas) |
| [0006](0006-auditoria.md) | Auditoria por wallet (imutável, origem, diferença por campo) | Proposta (visibilidade já decidida: todos veem tudo) |
| [0007](0007-flutter-nos-clientes.md) | Flutter nos apps nativos (Windows, macOS, Android, iOS) e na web | Substituída pela [0009](0009-react-tauri-capacitor.md) |
| [0008](0008-linguagem-visual.md) | Linguagem visual: a mesma do image-resizer (shadcn, Tailwind, estilo macOS) | Aceita (moldura da janela e celular em aberto) |
| [0009](0009-react-tauri-capacitor.md) | React com shadcn e Tailwind; Tauri no desktop, Capacitor no celular | Aceita (prova de conceito pendente) |
| [0010](0010-nextjs-na-vercel.md) | Web primeiro, em Next.js na Vercel, com páginas públicas e a API dentro | Aceita (ORM: Drizzle; API REST + zod + OpenAPI; banco: Neon) |
| [0011](0011-traducoes.md) | Traduções em pt-BR e en (pt-PT depois), mensagens ICU, API devolve códigos | Aceita (padrão: en; biblioteca em aberto) |
| [0014](0014-prestacoes-por-recorrencia.md) | Valor da prestação, primeiro vencimento e término por data ou quantidade usando recorrências | Aceita |
| [0015](0015-tags-de-producao.md) | Tags anotadas para marcar versões publicadas e orientar reversões | Aceita |
| [0016](0016-competencia-das-faturas.md) | Faturas e compras no extrato pelo mês de vencimento | Aceita |
| [0017](0017-bens-e-financiamentos.md) | Associação entre bens e dívidas, sem duplicação no patrimônio | Aceita |
| [0019](0019-inicio-personalizavel.md) | Início personalizável por pessoa e wallet, com gráficos de saldo e de receitas x despesas | Aceita (sync nos apps nativos em aberto) |

## Status

A [0013 — Janela de autenticação sobre a Home](0013-janela-de-autenticacao.md) está aceita: rotas paralelas pela Home, página independente no acesso direto; amarelo minimiza e verde restaura, com URL correspondente.

A [0012 — Motion para animações React](0012-motion.md) está aceita. Entrada e troca de telas animadas no contêiner compartilhado, com movimento reduzido respeitado.

- **Proposta:** escrita, aguardando confirmação das perguntas em aberto.
- **Aceita:** confirmada; o código deve seguir.
- **Substituída:** trocada por outra decisão (com link).

## Formato de cada arquivo

1. Contexto: o problema e de onde veio o pedido.
2. Decisão: o que fazer, em regras verificáveis.
3. Modelo de dados e API, quando houver.
4. Diferenças em relação ao Wallefy e ao Minhas Economias.
5. Perguntas em aberto.

A [0018 — Resultado acumulado do extrato](0018-resultado-acumulado-do-extrato.md) está aceita: saldo previsto com saldo inicial, movimentos pagos e pendências até o mês selecionado; apenas o filtro de conta restringe o saldo.

A [0025 — Desenvolvimento local e notas de versão](0025-desenvolvimento-local-e-release-notes.md) está aceita: consolidar mudanças na branch, testar localmente e manter notas não publicadas até uma release autorizada.

A [0020 — Carregamento progressivo do extrato](0020-carregamento-progressivo-do-extrato.md) está aceita: resumo e lista independentes, na branch local, com skeleton e retry por bloco.

A [0021 — Carregamento progressivo em todas as páginas](0021-carregamento-progressivo-em-todas-as-paginas.md) está aceita: recursos independentes, skeletons e erros locais, sem publicação nesta etapa.

A [0022 — Dívida realizada e previsões dos cartões](0022-divida-realizada-e-previsoes-dos-cartoes.md) está aceita: limite usado e patrimônio excluem previsões futuras, mantendo parcelas de compras já realizadas.

- [0023 — Contas e próximas faturas](0023-contas-e-proximas-faturas.md): aceita para avaliação local.
- [0024 — Organização das informações nas telas](0024-organizacao-das-telas.md): aceita para avaliação local.

- [0026 — Período personalizado do Extrato](0026-periodo-personalizado-do-extrato.md): aceita.
