# Wiki — engenharia reversa do Minhas Economias

Esta wiki documenta como o app de finanças pessoais **Minhas Economias** (portal web, versão 7.18.1) funciona: telas, fluxos, regras de negócio, API e problemas encontrados. Ela é a base de contexto do projeto **finfy** e é lida por agentes diferentes (Claude Code, Codex, IA local), então precisa ficar completa e atualizada.

- **Fonte:** inspeção manual do portal `portal.minhaseconomias.com.br` com uma conta de teste, interceptando as chamadas de rede no navegador.
- **Última atualização:** 2026-10-27.
- **Regras para editar esta wiki:** veja [MANUTENCAO.md](MANUTENCAO.md).

## Índice

### Visão geral

| Página | Conteúdo |
| --- | --- |
| [visao-geral.md](visao-geral.md) | O que é o app, para quem é, plano gratuito x pago |
| [arquitetura.md](arquitetura.md) | Stack, domínios, autenticação, sessão, observabilidade |
| [navegacao.md](navegacao.md) | Rotas, menu, barra superior, painel do perfil |
| [glossario.md](glossario.md) | Termos do app e da API |

### Funcionalidades

| Página | Conteúdo |
| --- | --- |
| [funcionalidades/transacoes.md](funcionalidades/transacoes.md) | Gasto, ganho, transferência, parcelado, tags, detalhes, revisão, exclusão |
| [funcionalidades/recorrencias.md](funcionalidades/recorrencias.md) | Lançamentos que se repetem e projeção |
| [funcionalidades/regras.md](funcionalidades/regras.md) | Categorização automática |
| [funcionalidades/categorias.md](funcionalidades/categorias.md) | Categorias e subcategorias padrão e do usuário |
| [funcionalidades/extrato.md](funcionalidades/extrato.md) | Lista, calendário, filtros, exportação |
| [funcionalidades/saldo-e-relatorios.md](funcionalidades/saldo-e-relatorios.md) | Meu Saldo, Resumo do Mês, Meus Gastos, limites |
| [funcionalidades/contas-cartoes.md](funcionalidades/contas-cartoes.md) | Contas e cartões manuais |
| [funcionalidades/conexoes-bancarias.md](funcionalidades/conexoes-bancarias.md) | Open Finance e migração da versão antiga |
| [funcionalidades/patrimonio-e-bens.md](funcionalidades/patrimonio-e-bens.md) | Patrimônio líquido, investimentos, bens |
| [funcionalidades/objetivos.md](funcionalidades/objetivos.md) | Metas financeiras e depósitos |
| [funcionalidades/membros.md](funcionalidades/membros.md) | Pessoas da família |
| [funcionalidades/paineis-e-widgets.md](funcionalidades/paineis-e-widgets.md) | Painel Início e painéis personalizados |
| [funcionalidades/plano-ajuda-e-extras.md](funcionalidades/plano-ajuda-e-extras.md) | Meu Clube, Meu Aprendizado, Segurança, Ajuda, MCP |

### API

| Página | Conteúdo |
| --- | --- |
| [api/endpoints.md](api/endpoints.md) | Todos os endpoints vistos, leitura e escrita |
| [api/payloads.md](api/payloads.md) | Corpos de requisição e resposta das escritas |
| [api/modelo-de-dados.md](api/modelo-de-dados.md) | Entidades, campos e enums |

### Decisões do finfy

| Página | Conteúdo |
| --- | --- |
| [decisoes/README.md](decisoes/README.md) | Índice e status das decisões |
| [decisoes/0001-multimoeda.md](decisoes/0001-multimoeda.md) | Wallets em EUR ou BRL, dinheiro em centavos, consolidação |
| [decisoes/0002-wallets-e-compartilhamento.md](decisoes/0002-wallets-e-compartilhamento.md) | Várias wallets, papéis, matriz de permissões, transferência de posse |
| [decisoes/0003-convites-por-email.md](decisoes/0003-convites-por-email.md) | Convites para wallets por e-mail |
| [decisoes/0004-seguranca-da-conta.md](decisoes/0004-seguranca-da-conta.md) | Senha (Argon2id, salt, pepper), MFA, sessões, limites |
| [decisoes/0005-offline-first-e-sincronizacao.md](decisoes/0005-offline-first-e-sincronizacao.md) | O que funciona sem internet, fila de alterações, conflitos, acesso revogado |
| [decisoes/0006-auditoria.md](decisoes/0006-auditoria.md) | Histórico de alterações e de acesso por wallet |
| [decisoes/0007-flutter-nos-clientes.md](decisoes/0007-flutter-nos-clientes.md) | Flutter em todos os clientes (substituída pela 0009) |
| [decisoes/0008-linguagem-visual.md](decisoes/0008-linguagem-visual.md) | Interface igual à do image-resizer: shadcn, Tailwind, tokens e princípios Apple |
| [decisoes/0009-react-tauri-capacitor.md](decisoes/0009-react-tauri-capacitor.md) | React em todos os clientes; Tauri no desktop, Capacitor no celular; web sem dados locais |
| [decisoes/0010-nextjs-na-vercel.md](decisoes/0010-nextjs-na-vercel.md) | Web primeiro: Next.js na Vercel com páginas públicas, app logado e API; estrutura do monorepo |
| [decisoes/0011-traducoes.md](decisoes/0011-traducoes.md) | Idiomas pt-BR e en, regras de tradução, idioma por endereço nas páginas públicas e por conta no app |

Início personalizável: [0019 — Blocos e gráficos por pessoa](decisoes/0019-inicio-personalizavel.md) (aceita; disposição fora da auditoria).

Bens e financiamentos: [0017 — Associação entre bem e dívida](decisoes/0017-bens-e-financiamentos.md) (aceita; implementação com seleção nos dois cadastros).

Competência de cartão: [0016 — Faturas pelo vencimento](decisoes/0016-competencia-das-faturas.md) (aceita).

### Modelo do finfy (em inglês)

Versões publicadas: [0015 — Tags de produção](decisoes/0015-tags-de-producao.md) (aceita; primeira tag `v0.1.0`).

Prestações: [0014 — Registrar só as prestações por recorrência](decisoes/0014-prestacoes-por-recorrencia.md) (aceita; vencimento e término por data ou quantidade).

Janela de login: [0013 — Sobre a Home ou página independente](decisoes/0013-janela-de-autenticacao.md) (aceita; rotas paralelas e interceptadas).

Animações React: [0012 — Motion](decisoes/0012-motion.md) (aceita; entrada e troca de telas com movimento reduzido respeitado).

| Página | Conteúdo |
| --- | --- |
| [finfy/codebase.md](finfy/codebase.md) | Estrutura do código, comandos, regras de código e o que já foi implementado |
| [finfy/data-model.md](finfy/data-model.md) | Modelo de dados do finfy: diagramas e tabelas de identidade, wallets, núcleo financeiro, planejamento, sincronização e auditoria |

### Referências

| Página | Conteúdo |
| --- | --- |
| [referencias/wallefy.md](referencias/wallefy.md) | O que o Wallefy (my-fin) já tem e as lacunas encontradas |

### Qualidade e testes

| Página | Conteúdo |
| --- | --- |
| [problemas-encontrados.md](problemas-encontrados.md) | Bugs, inconsistências e riscos |
| [testes/historico-de-testes.md](testes/historico-de-testes.md) | O que foi testado, quando e como; regressão do extrato validada em PostgreSQL descartável |
| [testes/dados-de-teste.md](testes/dados-de-teste.md) | Itens [TESTE] que existem na conta de teste |
| [pendencias.md](pendencias.md) | O que ainda não foi testado ou documentado |

Resultado do extrato: [0018 — Resultado acumulado](decisoes/0018-resultado-acumulado-do-extrato.md) (aceita; saldo previsto com saldo inicial, movimentos pagos e pendências até o mês selecionado).

Notas de versão: [Histórico de alterações](../CHANGELOG.md), com mudanças ainda não publicadas. Fluxo local e consolidação das releases: [0025](decisoes/0025-desenvolvimento-local-e-release-notes.md).

Extrato progressivo: [0020](decisoes/0020-carregamento-progressivo-do-extrato.md), com resumo e lista independentes e recuperação de erro por bloco.

Carregamento progressivo nas demais páginas: [0021](decisoes/0021-carregamento-progressivo-em-todas-as-paginas.md), com skeletons e recuperação de erro por bloco.

Dívida realizada dos cartões: [0022](decisoes/0022-divida-realizada-e-previsoes-dos-cartoes.md), separando limite/patrimônio das previsões futuras.

Organização de Contas: [0023](decisoes/0023-contas-e-proximas-faturas.md). Distribuição das informações nas telas: [0024](decisoes/0024-organizacao-das-telas.md).

Extrato com [período personalizado](decisoes/0026-periodo-personalizado-do-extrato.md), inclusive entre meses.
