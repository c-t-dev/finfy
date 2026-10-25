# 0001 — Várias moedas

> Status: Proposta · Última atualização: 2026-10-25

## Contexto

O Minhas Economias só trabalha em reais. O finfy precisa atender pessoas com dinheiro em euros e em reais, cada wallet numa dessas moedas.

## Decisão

1. **Cada wallet tem uma moeda**, escolhida na criação: `EUR` ou `BRL` (códigos ISO 4217). A lista de moedas aceitas fica numa tabela de configuração, para incluir outras depois (ex.: `USD`) sem mudar código.
2. **Tudo dentro da wallet usa a moeda dela:** contas, cartões, transações, orçamentos, objetivos, bens. Nenhuma soma mistura moedas.
3. **A moeda não muda depois que a wallet tem lançamentos.** Antes disso pode ser trocada.
4. **Dinheiro é inteiro em unidades menores** (centavos) mais o código da moeda. Nunca ponto flutuante. EUR e BRL têm 2 casas; a quantidade de casas vem da tabela de moedas (`minor_units`), não fixa em ×100.
5. **Formatação pelo idioma do usuário**, não pela moeda: em pt-BR, `R$ 1.234,56` e `€ 1.234,56`; em pt-PT, `1234,56 €` e `1234,56 R$`. Usar `Intl.NumberFormat`.
6. **Visão consolidada entre wallets (v1):** mostra um total por moeda, lado a lado, sem converter.
7. **Conversão (depois da v1):** tabela de cotações diárias; o total consolidado converte para a moeda preferida do usuário e mostra a data da cotação. Transferência entre wallets de moedas diferentes fica para essa fase, registrando o valor de cada lado e a taxa usada.

## Modelo de dados

| Tabela | Campos |
| --- | --- |
| `currencies` | `code` (PK, ISO 4217), `name`, `symbol`, `minor_units`, `is_enabled` |
| `wallets` | `currency_code` (FK → `currencies`), `currency_locked_at` (preenchido no primeiro lançamento) |
| `users` | `preferred_currency_code` (para a visão consolidada) |
| `fx_rates` (depois da v1) | `date`, `base_code`, `quote_code`, `rate` (decimal com 8 casas), `source`; único por (`date`, `base_code`, `quote_code`) |

Colunas de valor: `amount_minor` (inteiro, 64 bits). Quem lê converte com `minor_units`.

## Diferenças

- **Wallefy:** permite conta numa moeda diferente da wallet (`accounts.currency`). O finfy proíbe na v1 para manter somas e relatórios corretos sem câmbio.
- **Wallefy:** converte sempre ×100. O finfy usa `minor_units` por moeda.
- **Minhas Economias:** só BRL e valores em decimal no JSON (`12.5`).

## Perguntas em aberto

- [ ] Só EUR e BRL na v1, ou já incluir USD?
- [ ] Uma wallet deve aceitar contas em outra moeda (ex.: conta em dólar numa wallet em euro)?
- [ ] A visão consolidada precisa converter já na v1? Se sim, de qual fonte vêm as cotações (BCE, Banco Central do Brasil, serviço pago)?
