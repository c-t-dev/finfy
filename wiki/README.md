# Wiki — engenharia reversa do Minhas Economias

Esta wiki documenta como o app de finanças pessoais **Minhas Economias** (portal web, versão 7.18.1) funciona: telas, fluxos, regras de negócio, API e problemas encontrados. Ela é a base de contexto do projeto **finfy** e é lida por agentes diferentes (Claude Code, Codex, IA local), então precisa ficar completa e atualizada.

- **Fonte:** inspeção manual do portal `portal.minhaseconomias.com.br` com uma conta de teste, interceptando as chamadas de rede no navegador.
- **Última atualização:** 2026-10-25.
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

### Qualidade e testes

| Página | Conteúdo |
| --- | --- |
| [problemas-encontrados.md](problemas-encontrados.md) | Bugs, inconsistências e riscos |
| [testes/historico-de-testes.md](testes/historico-de-testes.md) | O que foi testado, quando e como |
| [testes/dados-de-teste.md](testes/dados-de-teste.md) | Itens [TESTE] que existem na conta de teste |
| [pendencias.md](pendencias.md) | O que ainda não foi testado ou documentado |
