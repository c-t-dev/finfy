# Contas e próximas faturas

> Última atualização: 2026-11-06
> Status: Aceita para avaliação local

## Decisão

Aplicar na mesma branch local, conforme autorização do usuário:

- Contas mostra saldos e cartões; patrimônio, bens e dívidas ficam em uma página própria acessível também pelo item Bens e dívidas no menu principal, após Contas e cartões (revisão autorizada pelo usuário).
- Cada cartão destaca a primeira fatura não paga com total positivo e vencimento a partir de hoje. O valor a pagar é o total em aberto de todos os lançamentos do ciclo, inclusive com data futura. O título usa o mês do vencimento salvo.
- Dívidas vencidas aparecem em alerta separado, com link para a mais antiga.
- Não separar lançamentos já cadastrados como “Apenas previsão”: todos integram o valor em aberto da fatura. Revisão solicitada pelo usuário em 2026-11-06.
- Limite utilizado e parcelas futuras ficam nos detalhes, mantendo a regra financeira da 0022.
- O link abre o ciclo correto pelo mês interno de referência. O total do resumo corresponde ao total nos detalhes da mesma fatura.

A apresentação substitui o ciclo em andamento descrito em 0016 e 0022. currentInvoice permanece na API por compatibilidade. Sem migração nem alteração dos registros financeiros. Sem publicação.

## Validação

Testes sintéticos da próxima fatura, vencidas, lançamentos futuros, faturas pagas e vencimento hoje. Teste React verifica links e patrimônio fora do resumo principal. Interface conferida no navegador local sem modificar dados.
