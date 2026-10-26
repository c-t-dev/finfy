# Resultado acumulado do extrato

> Última atualização: 2026-10-26
> Status: Aceita

## Contexto

O usuário confirmou que o Resultado deve considerar o saldo acumulado das contas até o mês selecionado. Receitas menos despesas do mês não inclui o saldo inicial nem os movimentos anteriores. Confirmou também que categoria, tag e busca não restringem esse saldo.

## Decisão

- O cartão do extrato passa a se chamar **Resultado acumulado**, com explicação traduzida.
- Soma os saldos iniciais das contas atualmente ativas e seus movimentos `PAID`, não arquivados, com `transaction_date` até o último dia do mês selecionado. Segue os sinais do saldo de contas (`BALANCE_SIGN`).
- Aplica apenas o filtro de conta. Categoria, tag e descrição continuam filtrando a lista e receitas/despesas do mês.
- Contas arquivadas ficam fora, seguindo a listagem padrão de contas ativas. O resultado histórico usa o estado atual dos registros, não uma reconstrução da auditoria.
- O saldo inicial não possui data de vigência no modelo. Entra também nos meses anteriores à criação da conta; não se inventa uma data de abertura.
- Meses futuros incluem somente movimentos já marcados como pagos até o fim daquele mês. Pendências e projeções de recorrência não entram.
- Transferências se compensam quando ambas as contas estão incluídas. Ao selecionar uma conta, sua perna altera o saldo normalmente.
- Compras de cartão não alteram saldo de conta. O pagamento da fatura desconta uma vez, na data do movimento; reabrir arquiva o pagamento e restaura o saldo. A competência das despesas continua pelo vencimento, conforme [0016](0016-competencia-das-faturas.md).
- Bens, dívidas e compras de cartão ainda não pagas não são deduzidos deste resultado. Patrimônio mantém seu cálculo próprio.
- Receitas, despesas e pendências mensais mantêm suas regras. O Resultado mensal da Home permanece receitas menos despesas.

## Modelo de dados e API

Sem mudança de tabelas nem migração. `GET /api/wallets/{id}/transactions` acrescenta `summary.accumulatedBalanceMinor`, calculado no servidor sem limite de linhas e sem depender da lista paginada. Usa `to` como limite inclusivo; `from` não limita o saldo. OpenAPI atualizado.

## Referências e perguntas

Regra própria do finfy, aprovada pelo usuário. As regras de status, sinais e contas arquivadas seguem o saldo já implementado. Sem perguntas em aberto neste escopo.
