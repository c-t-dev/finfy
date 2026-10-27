# Dívida realizada e previsões dos cartões

> Última atualização: 2026-10-27
> Status: Aceita

## Contexto

A tela de Contas somava projeções futuras de cartão no limite usado e no patrimônio. O usuário confirmou a separação entre compras já realizadas e gastos futuros previstos, mantendo as parcelas de compras já realizadas como dívida e as previsões no extrato.

## Decisão

- `Card.usedMinor` e `NetWorth.cardDebtMinor` usam a mesma regra de dívida realizada ainda não quitada.
- Considerar compras não arquivadas/não canceladas em faturas abertas e não arquivadas, com data de compra até hoje, inclusive.
- Incluir também parcelas futuras quando o lançamento original (primeira parcela) já ocorreu. A origem deve pertencer à mesma wallet e ao mesmo cartão, não estar arquivada/cancelada e ter data até hoje. A primeira parcela pode já estar quitada: as demais continuam sendo dívida.
- Se a compra original inteira ainda é futura, suas parcelas não entram antes da data de origem. Lançamentos futuros avulsos ou gerados por recorrência também ficam fora até sua data.
- Ao pagar uma fatura, suas compras deixam de consumir limite e de compor a dívida; o pagamento reduz o saldo da conta. Reabrir restaura a dívida, seguindo as mesmas regras de data.
- Extrato, resultado previsto, competência de despesas e planejamento mantêm as previsões. O total da fatura do ciclo continua incluindo seus lançamentos previstos. Não confundir esse total com o limite usado em todas as faturas.
- A interface explica o escopo do limite usado e do patrimônio. A lista destaca a próxima fatura realizada a pagar, conforme a [0023](0023-contas-e-proximas-faturas.md).
- Seguir a data UTC usada pelas consultas financeiras atuais. A apuração representa o estado atual dos registros; não reconstrói auditoria histórica.

## Modelo e API

Sem tabelas, campos ou migrações novos. Atualizar a semântica documentada de `usedMinor` e `cardDebtMinor`, preservando o formato das respostas. A implementação compartilha a consulta de dívida entre cartões e patrimônio. Saldos de conta e bens/dívidas cadastrados mantêm suas regras.

## Validação

PostgreSQL descartável com todas as migrações: compras até hoje, recorrências e avulsos futuros, parcelas futuras de compra realizada, compra original ainda futura, origem paga, cancelada ou arquivada, faturas pagas/arquivadas, isolamento de wallet, avanço da data, quitação e reabertura. As previsões continuam presentes no resumo do extrato.

## Rótulos

Após revisão pelo usuário, substituir Faturas em aberto por Dívida total dos cartões. Explicar que inclui parcelas a vencer e não representa só o valor a pagar no mês. A apresentação da lista foi substituída pela [0023](0023-contas-e-proximas-faturas.md): próximas faturas realizadas, vencidas e previsões separadas. Mudança de texto autorizada; não altera novamente a fórmula financeira.