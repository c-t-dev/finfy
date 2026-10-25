# Contas e cartões

> Última atualização: 2026-10-25

Cada conta ou cartão entra por conexão bancária (automática, ver [conexoes-bancarias.md](conexoes-bancarias.md)) ou por cadastro manual. No manual, o próprio app avisa que, se o usuário esquecer de lançar algo, os relatórios ficam errados.

## Conta "Minha Carteira"

Toda conta de usuário já vem com "Minha Carteira" (tipo `CARTEIRA`, instituição 0), marcada como principal (`main: true`).

## Conta manual

Caminho: Início → Contas Bancárias → "+ Adicionar" → "Registre suas transações manualmente" → aviso sobre lançamentos manuais → "Seguir manualmente" → escolher a instituição → formulário "Criar conta".

| Campo | Valores |
| --- | --- |
| Apelido (obrigatório) | Preenchido com o nome do banco |
| Tipo de conta (obrigatório) | Conta Corrente, Poupança, Investimento, Benefícios, Outros |
| Instituição | 105 instituições (`GET /financial-core/v1/institutions`, com código ISPB) |
| Conta principal | "Conta manual mais utilizada": já vem selecionada ao registrar transação |

Salvar: `POST /financial-core/v1/accounts` (201). A API aceita `balance` (saldo inicial) e `lockInitialBalance`, que a tela não oferece. Contas podem ser arquivadas (`archived`).

## Cartão manual

Caminho: Início → Cartões de Crédito → "Adicionar cartão" → "Adicionar um novo cartão manualmente" (a opção automática é a recomendada).

| Campo | Valores |
| --- | --- |
| Apelido (obrigatório) | texto |
| Conta (obrigatório) | conta que paga a fatura |
| Bandeira (obrigatório) | Visa, Mastercard, Hipercard, American Express, Elo, Outra |
| Vencimento (obrigatório) | dia do mês |
| Data de fechamento (obrigatório) | dia do mês |
| Limite mensal | opcional |

Salvar: `POST /financial-core/v1/credit/cards` (201). O corpo envia `cutoffDate`; a resposta devolve `cutOffDate` (grafia diferente), além de `usedValue`, `annuity` e a imagem da bandeira.

Com fechamento e vencimento, o app gera faturas. Faturas em aberto entram na projeção do Meu Saldo, e o pagamento usa a categoria interna "Fatura". **Ainda não testado:** gasto pago com cartão e o ciclo da fatura.

## Listagens

- `GET /financial-core/v1/accounts?archive=true|false`
- `GET /financial-core/v1/accounts/types`
- `GET /financial-core/v1/credit/cards?archived=true`
- `GET /financial-core/v1/credit/cards/brands`
- `GET /financial-core/v1/balances/detail?date=` (saldo total e por banco)
