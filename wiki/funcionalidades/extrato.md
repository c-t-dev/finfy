# Extrato

> Última atualização: 2026-10-25

O Extrato (`/transactions/`) lista todas as transações, passadas e projetadas, agrupadas por dia, com um gráfico mensal no topo e o painel de gastos por categoria à direita.

## Visões

- **Gráfico (lista):** barras mensais com Ganhos, Gastos e Resultado do mês selecionado; abaixo, a lista por dia ("Hoje", "Quarta, 25 de Novembro"...), incluindo meses futuros projetados.
- **Calendário:** grade do mês com navegação. Trocar o mês atualiza o painel de categorias.

Problemas: o calendário abre no último mês projetado (ex.: março/2027), não no mês atual; clicar num dia não filtra a lista, que continua mostrando todos os meses.

## Barra de ferramentas

| Ícone | Função |
| --- | --- |
| Busca | Texto livre em "Buscar transação" |
| Planilha | Exportar planilha (ver abaixo) |
| Funil (com contador) | Filtros |
| Calendário com seta | Recorrências / "Criar recorrência" |
| Corrente | "Fazer conexão" (catálogo de bancos) |

## Filtros

Contas Bancárias, Cartões de Crédito, Categorias, Situação da transação (Confirmada, Pendente, Ignorada; as duas primeiras vêm marcadas), Tipo (Ganhos, Gastos), Condição de pagamento (À vista, Parcelado, Recorrente), Membros e Tags (só aparece se existir tag). "Aplicar filtros" e "Limpar filtros".

Os filtros são aplicados no navegador, sem nova chamada à API.

## Painel lateral

Gastos por categoria do período (rosca) e lista de categorias com valor e "+ Definir limite". Ver [saldo-e-relatorios.md](saldo-e-relatorios.md#limites-por-categoria).

## Exportar planilha

Pela Ajuda do app: o ícone de planilha baixa um .xlsx com **todo** o histórico (sem escolher período), só no portal web. A flag `IS_EXPORT_SHEET_ENABLED` controla o botão.

No teste, o clique gerou um download `data:` montado no navegador (nenhuma chamada à API), mas nenhum arquivo apareceu na pasta Downloads. Pode ter sido bloqueado pelo navegador (Brave) ou ficado esperando o "Salvar como". Não confirmado.

## Listagem na API

`GET /financial-core/v2/transactions` com `fromDate`, `toDate`, `size`, `sortDirection`, `source=ACCOUNT`, `types=GASTO`, `statuses=[CONFIRMED, PENDING]`, `archived`, `is_review`. Resposta: `transactions[]`, `hasMore`, `pendingReviewCount`.
