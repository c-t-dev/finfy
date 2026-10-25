# Recorrências

> Última atualização: 2026-10-25

Uma recorrência é um cadastro que gera lançamentos repetidos (por exemplo, aluguel todo dia 5) e alimenta a projeção do Meu Saldo. Ela é diferente de uma regra: a regra não cria lançamentos, só recategoriza (ver [regras.md](regras.md)).

## Onde fica

- Extrato → ícone "Criar recorrência" abre a lista "Recorrências" (seção "Transações frequentes", com ordenação por valor).
- Detalhes de uma transação → Vínculos → Recorrências → "Criar" (já vem preenchido com os dados dela).

## Formulário

| Campo | Observação |
| --- | --- |
| Nome (obrigatório) | |
| Valor (obrigatório) | Seletor Gasto ou Ganho |
| Frequência (obrigatório) | Nunca, Diário, Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Semestral, Anual |
| Data (obrigatório) | Dia do mês (ex.: "Dia 25") |
| Conta / Cartão (obrigatório) | |
| A partir de | Data de início, padrão hoje |
| Categoria (obrigatório) | |

Abaixo aparece a "Próxima projeção" e "N transações identificadas", que são lançamentos já existentes que o app reconheceria como parte dessa recorrência.

## Como funciona por trás

1. Antes de salvar, o app chama `POST /financial-core/v2/transaction-recurrence/preview`, que devolve `matches[]` (transações reconhecidas), `discarded[]` e `previewLimit: 10`.
2. Salvar: `POST /financial-core/v2/transaction-recurrence` (resposta 201).
3. O servidor define uma **janela de reconhecimento**: dia ±3 (`dayBegin`/`dayEnd`) e valor ±10% (`valueBegin`/`valueEnd`). Ex.: R$ 12,50 no dia 25 → dias 22–28, R$ 11,25–13,75.
4. A recorrência gera ocorrências com `isConsolidated: false`: aparecem no Extrato e em Meus Gastos, mas **não entram no saldo** até serem efetivadas.
5. A projeção do Meu Saldo passa a descontar o valor em cada mês futuro.

## Editar

Ao salvar uma edição, o app pergunta o escopo:

- **Todas:** altera a recorrência e os lançamentos já vinculados.
- **Daqui pra frente:** altera a partir de hoje.

Pedido: `PATCH /financial-core/v2/transaction-recurrence/{uuid}` com `changes` (só os campos alterados), `conditions` (ex.: `TRANSACTION_DATE GREATER_THAN_OR_EQUAL hoje`), `applyToHistorical` e `allowClosedInvoices`. O app avisa que "as ocorrências serão atualizadas em breve" (processamento assíncrono).

## Problemas conhecidos

- Criar uma recorrência a partir de um gasto já lançado **não vincula esse gasto**: a prévia acha 0 transações e o app gera uma segunda transação igual no mesmo dia. Gastos passam a mostrar o dobro, mas o saldo não.
- Depois de editar o valor de R$ 12,50 para R$ 15,00, a janela ficou R$ 11,25–16,50: o limite inferior não foi recalculado.
- A ocorrência de hoje não mudou de valor logo após a edição "Daqui pra frente".
- A recorrência guarda sua própria categoria; regras alteram as ocorrências geradas, mas não o cadastro da recorrência.
- Em objetivos, o app avisa: "Recorrências são aplicadas em um objetivo como transações únicas, não sendo replicadas nos próximos meses."

Payloads em [../api/payloads.md](../api/payloads.md#recorrências).
