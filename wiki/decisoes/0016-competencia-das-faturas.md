# Competência das faturas pelo vencimento

> Última atualização: 2026-10-26
> Status: Aceita

## Contexto

O usuário confirmou que o título da fatura e as compras do cartão no extrato devem usar o mês de vencimento. O ciclo de 16/set a 15/out, com vencimento em 5/nov, é a fatura de novembro. A compra de 6/out pertence a novembro.

## Decisão

- O título da fatura e a identificação do pagamento usam o mês e ano do vencimento salvo na fatura.
- Extrato, resumo mensal, categorias da Home, planejamento e alertas de orçamento alocam cada compra no vencimento da fatura vinculada, independentemente do pagamento.
- O extrato agrupa compras pelo dia de vencimento. A linha mantém visível a data original da compra. Cada parcela segue sua própria fatura.
- O pagamento aparece na data efetiva e reduz o saldo da conta. Não entra novamente nos gastos. Pagar antecipadamente ou reabrir não muda a competência da compra.
- O mês de referência interno continua sendo o fechamento. IDs, rotas, vínculos e datas das faturas existentes permanecem. A navegação avança pelos mesmos ciclos, com título pelo vencimento.
- A listagem de cartões continua mostrando o ciclo atual de compras, seu total e vencimento. Saldos, limite utilizado e patrimônio mantêm suas regras.

## Modelo de dados e API

Sem migração. A resposta de lançamentos aceita statementDate, derivada do vencimento para compras e da data do lançamento para os demais tipos. transactionDate permanece intacta. A consulta usa a fatura salva, sem recalcular seu vencimento pelas configurações atuais do cartão. Lançamentos sem fatura válida usam a data original como fallback.

## Referências e perguntas

Regra própria do finfy, aprovada pelo usuário após o relato do erro. O ciclo de cartão do Minhas Economias continua sem teste completo; não foi usado para inferir a regra. Sem perguntas em aberto neste escopo.
