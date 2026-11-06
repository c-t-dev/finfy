# 0028 — Edição de compras no cartão

> Última atualização: 2026-11-06
> Status: Aprovada

Ao editar qualquer parcela, valor e data se referem a toda a compra: valor total e data original. Escolha confirmada pelo usuário em 2026-11-06.

- O formulário carrega todas as parcelas antes de editar e apresenta o total exato.
- O total é redistribuído nas mesmas parcelas, com centavos restantes na primeira. A quantidade não muda; nenhuma parcela pode ficar sem valor.
- A data original recalcula os vencimentos das parcelas por mês, limitando o dia ao último do mês, e suas faturas. Alterar somente o valor mantém as faturas existentes.
- IDs e tags são preservados. As versões de todas as parcelas são verificadas na mesma transação para evitar sobrescrever uma edição concorrente.
- Faturas pagas de origem ou destino precisam ser reabertas antes de alterar valor ou data. Descrição, categoria e observações continuam editáveis.
- GET no endpoint da compra retorna todas as parcelas; PATCH aceita `amountMinor`, `transactionDate` e `baseVersions`. Não há migração de esquema.
