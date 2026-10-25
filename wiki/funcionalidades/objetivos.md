# Objetivos

> Última atualização: 2026-10-25

Objetivos são metas financeiras com valor, prazo e depósitos. O app mostra quanto já foi guardado e quanto falta guardar por mês.

## Criar (`/objective/` → "Criar Objetivo")

16 modelos: Aposentadoria, Comprar uma casa, Comprar um bem, Comprar um carro, Fazer um aporte, Outros, Planejar sucessão, Planejar viagem, Poupar para estudos, Quitar uma dívida, Receber herança, Reserva de emergência, Tirar sabático, Vender carro, Vender casa, Vender um bem.

Formulário:

| Campo | Observação |
| --- | --- |
| Nome (obrigatório) | preenchido com o nome do modelo |
| Valor total (obrigatório) | meta |
| Já guardado | valor inicial |
| Ano final (obrigatório) | vira 31/12 do ano |

Ao preencher, aparece "Valor a guardar por mês".

Salvar: `POST /financial-core/v1/planning/goals` com `goalName`, `value`, `initialValue`, `uuidTypeGoal`, `endDate`. A resposta traz `typeGoal`, `fee`, `startDate`, `isCompleted`, configurações de notificação (`notificationInterval: MENSAL`, `sendNotification`, `emailNotification`, `pushNotification`, todas desligadas) e `valueSavedPerMonth[]`.

## Tipos por trás dos modelos

`GET /financial-core/v1/planning/goals/types`: `RETIREMENT` (Aposentadoria, `typeGoalFee` 7.45), `SAVINGS` (Poupança, 7.45), `CONTRIBUTION` (Aporte), `WITHDRAWAL` (Retirada), `DEBT` (Dívida). "Reserva de emergência" usa `SAVINGS`.

**A taxa não é aplicada:** o objetivo criado veio com `fee: 0`. Para juntar R$ 9.000 até dezembro de 2028, o app pediu R$ 343,74/mês, que é uma divisão simples pelos meses, sem rendimento.

## Tela de objetivos

- Card por objetivo: nome, prazo ("Faltam 2 anos"), guardado de quanto, barra de % e quanto falta.
- "Resumo dos objetivos": total guardado, em andamento, concluídos e próximo prazo.
- Botão "Ordenar".
- "Detalhe do objetivo": valores, "Histórico de movimentação" (ex.: "Valor inicial guardado") e "Registrar depósito". Menu ⋮ com outras ações (não testado).

## Registrar depósito

"Registrar depósito" leva ao Extrato com o painel "Selecione uma transação ou registre seu depósito manualmente".

- **Manual:** formulário "Depósito para objetivo" com valor, data e descrição.
- **De uma transação:** clicar numa transação existente (não testado).
- Também dá para lançar a partir de uma transação: Detalhes → Objetivos → "Lançar valor".

Salvar: `POST /financial-core/v1/planning/goals/{uuid}/register` com `uuidGoal`, `value`, `date`, `typeTransaction: GANHO` (201, devolve só o UUID).

Aviso do app: recorrências entram num objetivo como transações únicas, sem se repetir nos meses seguintes.
