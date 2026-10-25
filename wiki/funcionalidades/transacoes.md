# Transações

> Última atualização: 2026-10-25

Toda movimentação é uma transação de um de três tipos: gasto, ganho ou transferência. Ela fica ligada a uma conta ou cartão e, em gastos e ganhos, a uma categoria obrigatória.

## Formulário "Registrar transação"

Abre pelo menu lateral, pelo botão "+" verde no canto inferior direito ou por atalhos dos widgets. O formulário leva alguns segundos carregando (esqueleto cinza); **o que for digitado nesse intervalo se perde**.

| Campo | Gasto | Ganho | Transferência |
| --- | --- | --- | --- |
| Nome (obrigatório) | sim | sim | sim |
| Valor | sinal −, vermelho | sinal +, verde | sem sinal |
| Data (obrigatório) | padrão hoje | padrão hoje | padrão hoje |
| Conta | "Pago com": conta bancária ou cartão | "Recebido em": conta ou cartão | "Conta que saiu" e "Conta que entrou" |
| Condição | À vista ou Parcelado (pede nº de parcelas) | não tem | não tem |
| Categoria (obrigatório) | padrão Alimentação | padrão Salário | não tem |
| Tags | sim | sim | sim |
| Membros | associar membro | associar membro | não tem |

Detalhes de interface:

- O valor é digitado como centavos: "1250" vira 12,50. Ctrl+A não seleciona o campo; é preciso apagar com Backspace.
- O "1x" ao lado de "À vista" não é clicável; só vira seletor no modo Parcelado.
- O seletor de categoria tem busca, ordenação A–Z ou "Mais usadas", subcategorias expansíveis e "Nova categoria" quando a busca não acha nada.

## Como o servidor trata cada tipo

| Tipo | Endpoint | Comportamento |
| --- | --- | --- |
| Gasto ou ganho à vista | `POST /financial-core/v1/transactions` | Cria uma transação. `quantityInstallments` 0 (gasto) ou `null` (ganho). |
| Gasto parcelado | `POST /financial-core/v1/transactions` | Envia o valor total e `quantityInstallments: N`. O servidor cria N lançamentos de valor/N, um por mês, no mesmo dia. A resposta traz `totalValue`. |
| Transferência | `POST /financial-core/v1/transactions/transfer` | Cria duas transações espelhadas: uma saída (GASTO, categoria interna `1000002`) e uma entrada (GANHO), ligadas por `uuidTransferTransaction`. |

Payloads completos em [../api/payloads.md](../api/payloads.md).

## Tags

- Criar tag: `POST /financial-core/v1/tags` com `{"tagDescription": "..."}`.
- **Bug:** a tag escolhida no formulário de cadastro não é enviada (`tags: null`), nem quando a tag já existe. Só funciona adicionando depois, na tela de detalhes, via `PATCH` com `{"tags": ["nome"]}` (tags são enviadas pelo nome, não pelo UUID).
- O seletor de tags tem uma lixeira vermelha ao lado de cada tag (apaga a tag).
- O filtro "Tags" do Extrato só aparece depois que existe alguma tag.

## Detalhes da transação

Clicar numa transação abre "Detalhes da transação":

- Editar nome, valor e categoria (lápis).
- Tags.
- Vínculos: criar recorrência a partir dela, lançar valor num objetivo, associar membro.
- Controle de gastos: definir limite da categoria.
- Ícone de olho: **só esconde os valores (modo privacidade)**, não ignora a transação.
- "Apagar transação": ver abaixo.

Edição: `PATCH /financial-core/v2/transactions/{uuid}` com só os campos alterados.

## Revisar transações

Quando há transações para conferir, o Início mostra o banner "Venha revisar suas últimas transações". O fluxo mostra uma transação por vez com "Revisado", "Ver depois" e "Revisar todas".

- "Revisado" mostra um botão "Desfazer" e só envia o pedido ~5 segundos depois: `PATCH /financial-core/v2/transactions/{uuid}` com `{"is_review": true}`.
- As listagens devolvem `pendingReviewCount`.

## Ignorar

"Ignorada" existe como situação nos filtros, mas não há botão para ignorar uma transação manual. **(inferido)** Vale para transações importadas de banco.

## Apagar

- `DELETE /financial-core/v1/transactions/{uuid}?deleteType=SINGLE_TRANSACTION`, resposta 202 sem corpo.
- **Apaga na hora, sem pedir confirmação.**
- `deleteType` sugere outros modos (parcelas, recorrência), ainda não vistos.

## Horário

O app envia a hora local em `dateTransaction`, mas o servidor grava sempre 12:00.
