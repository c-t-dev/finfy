# Payloads das escritas

> Última atualização: 2026-10-25

Corpos reais capturados em 2026-10-25, com IDs da conta trocados por marcadores. O app envia os corpos como bytes UTF-8 de um JSON.

## Transações

### Criar gasto à vista

`POST /financial-core/v1/transactions`

```json
{
  "description": "[TESTE] Lanche",
  "value": 12.5,
  "dateTransaction": "2026-10-25T05:33:14.960",
  "idCategory": 6,
  "quantityInstallments": 0,
  "currentTransaction": null,
  "tags": null,
  "isConsolidated": true,
  "uuidMember": null,
  "uuidAccount": "{uuidAccount}",
  "invoiceReferenceDate": "2026-10-25",
  "typeTransaction": "GASTO",
  "consolidated": true
}
```

Resposta 200: lista com a transação criada (`uuidTransaction`, `dateTransaction` sempre às 12:00, `isDeletable`, `isEditable`, `isCategoryEditable`, `isDisabled`, `isConsolidated`, `archived`, `isSuggestion`). `tags` vai `null` mesmo com tag escolhida (bug).

### Criar ganho

Mesmo endpoint. Diferenças: `"typeTransaction": "GANHO"`, `"idCategory": 1` (Salário), `"quantityInstallments": null`, `"invoiceReferenceDate": null`.

### Criar gasto parcelado

Mesmo endpoint, com o valor total e o número de parcelas (campos principais):

```json
{
  "description": "[TESTE] Geladeira",
  "value": 300.0,
  "idCategory": 7,
  "idSubcategory": 1000018,
  "quantityInstallments": 3,
  "typeTransaction": "GASTO",
  "uuidAccount": "{uuidAccount}",
  "invoiceReferenceDate": "2026-10-25"
}
```

Resposta: 3 transações de 100.00 em 2026-10-25, 2026-11-25 e 2026-12-25, com `totalValue: 300.00`.

### Transferência

`POST /financial-core/v1/transactions/transfer`

```json
{
  "description": "[TESTE] Transferência",
  "value": 100.0,
  "dateTransaction": "2026-10-25T06:03:57.148",
  "quantityInstallments": null,
  "tags": null,
  "isConsolidated": true,
  "uuidMember": null,
  "uuidAccountTo": "{uuidContaDestino}",
  "uuidAccountFrom": "{uuidContaOrigem}",
  "invoiceReferenceDate": null,
  "typeTransaction": null,
  "idInvoice": null,
  "consolidated": true
}
```

Resposta: a saída (`GASTO`, `idCategory: 1000002`) com `uuidTransferTransaction` apontando para a entrada.

### Editar transação

`PATCH /financial-core/v2/transactions/{uuid}` com só os campos alterados:

```json
{ "tags": ["teste"] }
```

```json
{ "is_review": true }
```

Resposta 200: transação completa com `category`, `subCategory`, `account`, `totalValue`.

### Apagar transação

`DELETE /financial-core/v1/transactions/{uuid}?deleteType=SINGLE_TRANSACTION` → 202, sem corpo.

### Criar tag

`POST /financial-core/v1/tags`

```json
{ "tagDescription": "teste" }
```

Resposta: `{ "uuidTag": "{uuid}", "description": "teste" }`.

## Recorrências

### Prévia e criação

`POST /financial-core/v2/transaction-recurrence/preview` e depois `POST /financial-core/v2/transaction-recurrence` (201), com o mesmo corpo:

```json
{
  "description": "[TESTE] Lanche",
  "recurrenceName": "[TESTE] Lanche",
  "day": 25,
  "value": 12.5,
  "frequencyType": "MENSAL",
  "frequencyWeekdays": null,
  "frequencyAnnualMonths": null,
  "uuidAccount": "{uuidAccount}",
  "uuidCreditCard": null,
  "idCategory": 6,
  "idSubCategory": null,
  "validFrom": "2026-10-25",
  "typeTransaction": "GASTO",
  "recurrenceType": "REGULAR"
}
```

Prévia: `{ "matches": [], "singleOccurrenceWarning": null, "discarded": [], "previewLimit": 10, "truncated": false }`.

Criação: `id`, `status: "ACTIVE"`, `dayBegin: 22`, `dayEnd: 28`, `valueBegin: 11.25`, `valueEnd: 13.75`, `installmentFinished`, `financialInstitution`, `category`.

### Editar

`PATCH /financial-core/v2/transaction-recurrence/{uuid}` ("Daqui pra frente"):

```json
{
  "conditions": [
    { "field": "TRANSACTION_DATE", "operator": "GREATER_THAN_OR_EQUAL", "value": "2026-10-25" }
  ],
  "applyToHistorical": true,
  "allowClosedInvoices": false,
  "changes": { "value": 15.0 }
}
```

Resposta: recorrência com `value: 15.00` e `valueEnd: 16.50`, mas `valueBegin` continuou 11.25.

## Regras

### Prévia

`POST /financial-core/v1/transactions/rule/preview`

```json
{
  "conditions": [
    { "field": "DESCRIPTION", "operator": "SIMILARITY", "value": "[TESTE]" },
    { "field": "TRANSACTION_TYPE", "operator": "EQUALS", "value": "GASTO" }
  ]
}
```

### Criar

`POST /financial-core/v1/transactions/rule`

```json
{
  "name": "[TESTE]",
  "conditions": [
    { "field": "DESCRIPTION", "operator": "SIMILARITY", "value": "[TESTE]" },
    { "field": "TRANSACTION_TYPE", "operator": "EQUALS", "value": "GASTO" }
  ],
  "actions": [ { "key": "CATEGORY", "value": "11" } ],
  "isAppliedToHistorical": true,
  "status": "ACTIVE"
}
```

Resposta: `ruleUUID`, `ruleId`, `scope: "INVESTOR"`, `status: "AT"`, `conditions[]` (com `idCondition`, `fieldName`, `operator` "=" para EQUALS), `actions[]` (com `idAction`, `fieldName`), `weight: 2`, `origin: "USER"`.

### Editar

`PUT /financial-core/v1/transactions/rule/{uuid}` com o objeto inteiro e `"status": "AT"`. Os `idCondition` são recriados.

## Categorias e limites

`POST /financial-core/v1/categories`

```json
{
  "idCategory": 0,
  "categoryName": "TESTE Hobby",
  "typeTransaction": "GASTO",
  "color": "#029D60",
  "flagEdit": true,
  "urlIcon": "https://cdn-dev.valebroker.com.br/dev/categories/star_white.svg",
  "isVisible": true,
  "edit": null
}
```

`POST /financial-core/v1/sub/categories`

```json
{ "idCategory": 7, "subCategoryName": "TESTE Jardim" }
```

Resposta: `{ "idSubCategory": ..., "idCategory": 7, "subCategoryName": "TESTE Jardim", "edit": true }`.

`POST /financial-core/v1/budget/category` (201)

```json
{ "category_id": 7, "year_month": "2026-10", "monthly_limit": 500.0, "alert_percentage": 80 }
```

## Contas e cartões

`POST /financial-core/v1/accounts` (201)

```json
{
  "accountName": "[TESTE] Conta",
  "balance": 0.0,
  "description": null,
  "accountType": "CONTA_CORRENTE",
  "idFinancialInstitution": 96,
  "main": false,
  "firstCharUppercase": "[",
  "lockInitialBalance": false
}
```

`POST /financial-core/v1/credit/cards` (201)

```json
{
  "uuidAccount": "{uuidAccount}",
  "name": "[TESTE] Cartão",
  "brand": "VISA",
  "limit": 2000.0,
  "dueDate": 10,
  "cutoffDate": 3
}
```

Resposta: `uuidCreditCard`, `brand: "Visa"`, `annuity: 0`, `usedValue: 0`, `main`, `dateConfirmation`, `cutOffDate: 3`, `dueDate: 10`, `brandImage`, `color`.

## Patrimônio, objetivos e membros

`POST /financial-core/v1/patrimony/assets` (201)

```json
{
  "idTypeCode": 10,
  "description": "[TESTE] Notebook",
  "currentValue": 3000.0,
  "depreciationRate": 1.0,
  "creditOperationIds": [],
  "purchaseValue": 4500.0,
  "purchaseDate": "2026-10-01",
  "icon": "https://cdn-dev.valebroker.com.br/dev/categories/notebook_white.svg",
  "color": "#0066CC"
}
```

Resposta: `id`, `typeName`, `purchaseDate: "01/10/2026"`, `debtPosition` (`debts`, `originalDebtTotal`, `outstandingDebtTotal`, `netValue`, `ownershipPercentage`).

`POST /financial-core/v1/planning/goals`

```json
{
  "goalName": "[TESTE] Reserva",
  "value": 10000.0,
  "initialValue": 1000.0,
  "uuidTypeGoal": "{uuidTypeGoal}",
  "endDate": "2028-12-31"
}
```

Resposta: `uuidGoal`, `totalValue`, `isCompleted`, `startDate`, `endDate`, `notificationInterval: "MENSAL"`, `sendNotification`, `emailNotification`, `pushNotification`, `typeGoal` (`typeGoalCode: "SAVINGS"`, `typeGoalFee: 7.45`), `fee: 0`, `valueSavedPerMonth[]`.

`POST /financial-core/v1/planning/goals/{uuid}/register` (201)

```json
{ "uuidGoal": "{uuidGoal}", "value": 250.0, "date": "2026-10-25", "typeTransaction": "GANHO" }
```

Resposta: só o UUID do lançamento, como string.

`POST /financial-core/v1/members`

```json
{ "name": "TESTE Maria", "image": null, "relationship": "FAMILIAR", "birthDate": null }
```

Resposta: `uuidMember`, `memberName`, `relationship: "Familiar"`, `totalSpending: 0`.

## Painéis

`POST /api/workspaces/create` (201)

```json
{ "name": "TESTE Painel", "type": "ANY_WHERE", "active": true, "visible": true, "lastColorLink": 4280391411 }
```

`POST /api/workspaces/components` (201)

```json
{
  "workspace_id": "{uuidWorkspace}",
  "id": "{uuid gerado no cliente}",
  "name": "Lista de Objetivos",
  "type": "ME_OBJECTIVE_LIST",
  "metadata": "{\"headerOptions\":{\"color_link\":4280391411},\"layout\":{\"left\":962.0,\"top\":418.1,\"width\":380.0,\"height\":280.0,\"index\":0,\"is_maximized\":false,\"area_width\":0.0,\"area_height\":0.0},\"component\":{\"configs\":{\"createdInAppVersion\":\"7.18.1\"}}}"
}
```

`PUT /api/workspaces/components/{uuid}/metadata` (204): `{ "metadata": "<mesmo JSON em string, com layout novo>" }`.
