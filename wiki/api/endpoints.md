# Endpoints

> Última atualização: 2026-10-25

Todos sob `https://api.minhaseconomias.com.br`. Autenticação por cookie de sessão (sem cabeçalho `Authorization`). Corpos das escritas em [payloads.md](payloads.md).

## Sessão, painéis e plataforma

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/api/authentication/v2/session/alive` | Mantém a sessão (~30 s) |
| GET | `/api/workspaces/list` | Painéis do usuário |
| POST | `/api/workspaces/create` | Cria painel |
| POST | `/api/workspaces/components` | Adiciona componente a um painel |
| PUT | `/api/workspaces/components/{uuid}/metadata` | Move ou redimensiona componente |
| GET | `/api/workspaces/home/widgets/settings/active` | Widgets do painel Padrão |
| GET | `/api/trademap/crm/announcement?position_list=MODAL_HOME_ME\|BANNER_ME` | Banners e modais de marketing |
| POST | `/api/trademap/v1/analytics/save-events` | Eventos de uso |
| POST | `/financial-core/v1/feature-name` | Feature flags |
| GET | `/v1/support/faqs` | Artigos da Ajuda |

## Transações

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v2/transactions` | Lista. Params: `fromDate`, `toDate`, `size`, `sortDirection`, `source=ACCOUNT`, `types`, `statuses=[CONFIRMED, PENDING]`, `archived`, `is_review` |
| GET | `/financial-core/v2/transactions/summary` | Totais por mês (`referenceMonth`, `totalGains`, `totalExpenses`, `balance`, `projected`) |
| POST | `/financial-core/v1/transactions` | Cria gasto ou ganho (à vista ou parcelado) |
| POST | `/financial-core/v1/transactions/transfer` | Cria transferência |
| PATCH | `/financial-core/v2/transactions/{uuid}` | Edita campos (tags, `is_review`...) |
| DELETE | `/financial-core/v1/transactions/{uuid}?deleteType=SINGLE_TRANSACTION` | Apaga (202; a tela não pede confirmação) |
| GET | `/financial-core/v1/tags` | Tags |
| POST | `/financial-core/v1/tags` | Cria tag |

## Recorrências e regras

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/v1/transaction/transactions/recurrence-types` | Frequências |
| GET | `/financial-core/v2/transaction-recurrence` | Lista |
| POST | `/financial-core/v2/transaction-recurrence/preview` | Prévia (transações reconhecidas) |
| POST | `/financial-core/v2/transaction-recurrence` | Cria (201) |
| PATCH | `/financial-core/v2/transaction-recurrence/{uuid}` | Edita com escopo |
| GET | `/financial-core/v1/transactions/rule` | Lista regras |
| GET | `/financial-core/v1/transactions/rule/suggestions` | Sugestões de regra |
| POST | `/financial-core/v1/transactions/rule/preview` | Prévia |
| POST | `/financial-core/v1/transactions/rule` | Cria |
| PUT | `/financial-core/v1/transactions/rule/{uuid}` | Edita (objeto inteiro) |

## Categorias e limites

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v1/categories` | Categorias |
| GET | `/financial-core/v1/categories/search` | Categorias com subcategorias e contadores de uso |
| GET | `/financial-core/v1/category-icons` | Ícones |
| POST | `/financial-core/v1/categories` | Cria categoria |
| POST | `/financial-core/v1/sub/categories` | Cria subcategoria |
| GET | `/financial-core/v1/expenses/summary` | Gastos/ganhos por categoria. Params: `year_month`, `type=expense\|gain`, `is_internal` |
| POST | `/financial-core/v1/budget/category` | Define limite mensal (201) |

## Saldo e fluxo de caixa

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v1/balances/detail` | Saldo total e por banco (`date` opcional) |
| GET | `/financial-core/v1/cash-flow/chart` | Gráfico do Meu Saldo (`fromDate`, `toDate`) |
| GET | `/financial-core/v1/cash-flow/pending-invoices` | Faturas em aberto (`from`, `to`) |
| GET | `/financial-core/v1/cash-flow/onboarding-status` | Tutorial visto |

## Contas, cartões e conexões

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v1/accounts?archive=` | Contas |
| GET | `/financial-core/v1/accounts/types` | Tipos de conta |
| POST | `/financial-core/v1/accounts` | Cria conta manual (201) |
| GET | `/financial-core/v1/institutions` | 105 instituições para conta manual |
| GET | `/financial-core/v1/credit/cards?archived=` | Cartões |
| GET | `/financial-core/v1/credit/cards/brands` | Bandeiras |
| POST | `/financial-core/v1/credit/cards` | Cria cartão manual (201) |
| GET | `/financial-core/v1/connection/financial-institutions` | Catálogo Open Finance |
| GET | `/financial-core/v2/connection/financial-institutions` | Catálogo Open Finance (v2, com busca) |
| GET | `/financial-core/v2/connections` | Conexões ativas |

## Patrimônio, bens e investimentos

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v1/patrimony/composition` | Patrimônio líquido (`categories=` opcional) |
| GET | `/financial-core/v1/patrimony/assets` | Bens |
| POST | `/financial-core/v1/patrimony/assets` | Cria bem (201) |
| GET | `/financial-core/v2/patrimony/asset-types` | Grupos e tipos de bem |
| GET | `/financial-core/v1/credit-operations/options` | Dívidas para ligar a um bem |
| GET | `/financial-core/v1/investments/positions` | Carteira de investimentos |
| GET | `/financial-core/v1/suggestion` | Sugestões |

## Objetivos e membros

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/financial-core/v1/planning/goals` | Objetivos |
| GET | `/financial-core/v1/planning/goals/types` | Tipos (com `typeGoalFee`) |
| GET | `/financial-core/v1/planning/goals/sub-types` | Subtipos |
| POST | `/financial-core/v1/planning/goals` | Cria objetivo |
| POST | `/financial-core/v1/planning/goals/{uuid}/register` | Depósito no objetivo (201) |
| GET | `/financial-core/v1/members` | Membros |
| GET | `/financial-core/v1/members/relationship` | Graus de parentesco |
| POST | `/financial-core/v1/members` | Cria membro |

## Ainda não vistos

Exclusão de recorrência, regra, categoria, conta, cartão, bem, objetivo e membro; edição de conta, cartão, bem, objetivo e membro; arquivar conta; pagamento de fatura. Ver [../pendencias.md](../pendencias.md).
