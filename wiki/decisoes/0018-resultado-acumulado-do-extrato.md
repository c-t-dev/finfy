# Resultado acumulado do extrato

> Última atualização: 2026-10-26
> Status: Aceita

## Contexto

O usuário confirmou que o Resultado deve considerar o saldo acumulado das contas até o mês selecionado. Receitas menos despesas do mês não inclui o saldo inicial nem os movimentos anteriores. Confirmou também que categoria, tag e busca não restringem esse saldo. Depois da primeira publicação, pediu valor positivo em verde, aviso do pendente abaixo e inclusão das pendências no acumulado. O resultado passa a representar o saldo previsto.

## Decisão

- O cartão do extrato passa a se chamar **Resultado acumulado**, com explicação traduzida.
- Soma o saldo confirmado (saldos iniciais das contas atualmente ativas e movimentos `PAID`) ao componente pendente com sinais de entrada e saída. Movimentos de conta usam `transaction_date` até o último dia do mês selecionado, sem registros arquivados. Segue `BALANCE_SIGN`. Valor positivo fica verde; negativo mantém o estilo de saída. O aviso abaixo mostra o efeito líquido pendente, inclusive zero quando entradas e saídas se compensam.
- Aplica apenas o filtro de conta. Categoria, tag e descrição continuam filtrando a lista e receitas/despesas do mês.
- Contas arquivadas ficam fora, seguindo a listagem padrão de contas ativas. O resultado histórico usa o estado atual dos registros, não uma reconstrução da auditoria.
- O saldo inicial não possui data de vigência no modelo. Entra também nos meses anteriores à criação da conta; não se inventa uma data de abertura.
- Meses passados e futuros incluem movimentos pagos e pendentes já registrados até o fim daquele mês, inclusive pendências anteriores. Não se geram ocorrências adicionais de recorrência para preencher a projeção.
- Transferências se compensam quando ambas as contas estão incluídas. Ao selecionar uma conta, sua perna altera o saldo normalmente.
- Compras pendentes de faturas não pagas entram como saída prevista no vencimento salvo da fatura, atribuídas à conta de pagamento configurada no cartão. Não alteram o saldo confirmado. Ao pagar, saem do componente pendente e o pagamento reduz o confirmado na data efetiva, uma única vez. Pagamento por outra conta usa essa conta efetiva. Ao reabrir, o pagamento é arquivado e as compras voltam à projeção no vencimento. A competência das despesas continua conforme [0016](0016-competencia-das-faturas.md).
- Bens e dívidas não entram neste resultado. Patrimônio e saldo efetivo das contas mantêm seus cálculos próprios.
- Receitas, despesas e pendências mensais mantêm suas regras. O Resultado mensal da Home permanece receitas menos despesas.

## Modelo de dados e API

Sem mudança de tabelas nem migração. `GET /api/wallets/{id}/transactions` retorna `summary.accumulatedBalanceMinor` (confirmado + pendente), `summary.confirmedBalanceMinor` e `summary.accumulatedPendingMinor`, calculados no servidor sem limite de linhas e sem depender da lista paginada. Usa `to` como limite inclusivo; `from` não limita o saldo. OpenAPI atualizado.

## Referências e perguntas

Regra própria do finfy, aprovada pelo usuário. As regras de status, sinais e contas arquivadas seguem o saldo já implementado. Sem perguntas em aberto neste escopo.

## Validação da consulta

A versão v0.2.2 revelou uma regressão de SQL: na seleção de uma tabela, o Drizzle removia a qualificação das colunas de subconsultas, causando referência ambígua a `id` (PostgreSQL `42702`). A correção mantém identificadores de tabela e coluna explícitos. As consultas completas de lista e totais são compartilhadas com testes em PostgreSQL descartável (PGlite), com todas as migrações reais. As regras de cálculo desta decisão permanecem.