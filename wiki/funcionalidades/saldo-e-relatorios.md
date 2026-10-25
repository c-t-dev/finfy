# Saldo e relatórios

> Última atualização: 2026-10-25

Meu Saldo, Resumo do Mês e Meus Gastos leem as mesmas transações e as agregam de jeitos diferentes: por dia, por mês e por categoria.

## Meu Saldo (`/cash_flow/`)

- "Saldo consolidado" do dia e gráfico diário: linha cheia para o histórico real, tracejada para a projeção ("Previsto").
- A projeção soma recorrências e faturas de cartão em aberto (`cash-flow/pending-invoices`).
- O app pede 18 meses: 12 para trás e 6 para frente (`GET /financial-core/v1/cash-flow/chart?fromDate=&toDate=`).
- Cada ponto: `date`, `balance`, `totalGains`, `totalExpenses`, `isLocked`; há também `byAccount` (série por conta), `recalculating` e `hasData`. **(inferido)** `isLocked` bloqueia trechos no plano gratuito.
- Abaixo do gráfico: lista por dia com "Resumo de <mês>" (entradas, saídas) e o saldo ao fim de cada dia.
- Busca, botão "Hoje", filtros e período. Na primeira visita abre um tutorial de duas telas (`cash-flow/onboarding-status`).

## Resumo do Mês (`/transactions/monthly-review`)

- Carrossel de meses no topo.
- Compara o mês escolhido com o anterior ("Comparando com Set/26").
- Gastos por categoria, com atalho "Ver ganhos".
- "Planejar meu próximo mês" avança para o mês seguinte, com valores projetados (`transactions/summary` devolve `projected: true`).

## Meus Gastos (`/my_expenses`)

- Navegação mês a mês.
- Gastos por categoria (rosca) com total; botão para alternar a visão.
- Gráfico "Gastos por dia".
- Lista de categorias com valor, barra de uso do limite e "+ Definir limite".
- "Últimas Transações" com "Ver extrato".
- API: `GET /financial-core/v1/expenses/summary?year_month=AAAA-MM&type=expense|gain&is_internal=true|false`.

## Limites por categoria

"+ Definir limite" abre um painel com:

- Gráfico do histórico mensal de gastos da categoria.
- "Limite mensal" em R$, válido "a partir de" um mês.
- "Me avisar quando atingir" com controle deslizante (padrão 80%).

Salvar: `POST /financial-core/v1/budget/category` com `category_id`, `year_month`, `monthly_limit`, `alert_percentage`, todos em snake_case. Depois disso, a categoria mostra uma barra de progresso com o quanto do limite foi usado.

## Inconsistência conhecida

Ocorrências geradas por recorrência (`isConsolidated: false`) entram em Meus Gastos e Gastos por categoria, mas não no saldo. Com um gasto real de R$ 12,50 e a cópia da recorrência, Gastos mostrou R$ 25,00 e o saldo −R$ 12,50.
