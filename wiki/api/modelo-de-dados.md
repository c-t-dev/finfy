# Modelo de dados

> Última atualização: 2026-10-25

Entidades inferidas a partir das respostas da API. Campos listados como aparecem no JSON.

## Conta

`uuidAccount`, `name`, `description`, `type`, `typeValue`, `idFinancialInstitution`, `financialInstitution` (`id`, `name`, `image_url`, `color`, `svg_white`), `image`, `color`, `main`, `archived`, `lastSyncedAt`, `connectionDeletion`, `dateInsert`, `dateUpdate`, `createdAt`, `updatedAt`.

`type`: `CARTEIRA`, `CONTA_CORRENTE`, `POUPANCA`, `INVESTIMENTO`, `BENEFITS`, `OUTROS`.

## Cartão de crédito

`uuidCreditCard`, `uuidAccount`, `name`, `brand`, `brandImage`, `limit`, `usedValue`, `annuity`, `dueDate`, `cutOffDate`, `main`, `dateConfirmation`, `color`, `idFinancialInstitution`.

`brand` (envio): `VISA`, `MASTERCARD`, `HIPERCARD`, `AMERICAN_EXPRESS`, `ELO`, `OUTRA`.

## Transação

`uuidTransaction`, `transactionId` (numérico), `description`, `originalDescription`, `value`, `totalValue`, `type`/`typeTransaction` (`GASTO`, `GANHO`), `date`/`dateTransaction`, `category`, `subCategory`, `account`, `uuidMember`, `tags`, `quantityInstallments`, `isConsolidated`, `projected`, `is_review`, `canMarkAsReviewed`, `isDisabled`, `isAdjustment`, `isInvoicePayment`, `invoice`, `isSuggestion`, `archived`, `isDeletable`, `isEditable`, `isCategoryEditable`, `uuidTransferTransaction`.

Status nos filtros: `CONFIRMED`, `PENDING` (e ignorada, nome de API não visto).

## Recorrência

`id`, `userId`, `recurrenceName`, `description`, `typeTransaction`, `value`, `day`, `dayBegin`, `dayEnd`, `valueBegin`, `valueEnd`, `frequencyType`, `frequencyWeekdays`, `frequencyAnnualMonths`, `uuidAccount`, `uuidCreditCard`, `idCategory`, `idSubCategory`, `validFrom`, `status` (`ACTIVE`), `recurrenceType` (`REGULAR`), `installmentFinished`.

`frequencyType`: `NUNCA`, `DIARIO`, `SEMANAL`, `QUINZENAL`, `MENSAL`, `BIMESTRAL`, `TRIMESTRAL`, `SEMESTRAL`, `ANUAL`.

## Regra

`ruleUUID`, `ruleId`, `name`, `scope` (`INVESTOR`), `status` (`ACTIVE` no envio, `AT` gravado), `origin` (`USER`), `weight`, `isAppliedToHistorical`, `createdAt`, `conditions[]` (`idCondition`, `fieldName`, `operator`, `value`), `actions[]` (`idAction`, `fieldName`, `value`).

Campos de condição vistos: `DESCRIPTION`, `TRANSACTION_TYPE`, `TRANSACTION_DATE`. Os de CPF/CNPJ, valor, dias, dias da semana, meses e conta existem na tela, mas o nome na API ainda não foi visto. Operadores: `SIMILARITY`, `EQUALS`, `GREATER_THAN_OR_EQUAL`. Ações: `CATEGORY` (descrição e membro existem na tela, nome na API não visto).

## Categoria e subcategoria

Categoria: `idCategory`, `categoryName`, `typeTransaction`, `color`, `urlIcon`, `isVisible`, `isInternal`, `flagEdit`, `transactionCount`, `transactionCountPeriodDays`, `priorityScore`, `subCategories[]`.

Subcategoria: `idSubCategory`, `idCategory`, `subCategoryName`, `edit`.

## Limite (orçamento)

`id`, `category_id`, `year_month`, `referenceMonth`, `monthly_limit`, `alert_percentage`, `created_at`, `createdAt`, `updatedAt`.

## Objetivo

`uuidGoal`, `goalName`, `value`, `totalValue`, `isCompleted`, `startDate`, `endDate`, `fee`, `typeGoal` (`uuidTypeGoal`, `typeGoalName`, `typeGoalFee`, `typeGoalCode`), `notificationInterval`, `sendNotification`, `sendPreviousNotification`, `emailNotification`, `pushNotification`, `valueSavedPerMonth[]` (`month`, `date`, `referenceMonth`, `value`).

`typeGoalCode`: `RETIREMENT`, `SAVINGS`, `CONTRIBUTION`, `WITHDRAWAL`, `DEBT`.

## Membro

`uuidMember`, `memberName`, `relationship`, `birthDate`, `image`, `totalSpending`, `createdAt`, `updatedAt`.

## Bem

`id`, `idTypeCode`, `typeName`, `description`, `currentValue`, `purchaseValue`, `purchaseDate`, `depreciationRate`, `icon`, `color`, `debtPosition` (`debts`, `originalDebtTotal`, `outstandingDebtTotal`, `netValue`, `ownershipPercentage`).

## Patrimônio

`netWorth`, `totalAssets`, `totalDebts`, `assets`/`debts` (`total`, `sections[]` com `type`/`sectionType`, `label`, `total`, `percentage`, `items[]`), `investmentIsStale`, `compositionDate`.

## Instituição de Open Finance

`type`, `uuidFinancialInstitution`, `financialInstitutionName`, `financialInstitutionType` (`PERSONAL_BANK`, `BOTH_BANK`, `LEGAL_BANK`), `typeConnection` (`OPEN_FINANCE`), `connectorType` (`LINA`), `credentials[]` (`name`, `label`, `validation`, `isHidden`, `isToken`, `placeholder`), `isActive`, `isBeta`, `ordination`, `cdBenefit`.

## Painel e componente

Painel: `id`, `name`, `type` (`ANY_WHERE`), `components[]`, `active`, `visible`, `locked`, `smart_tilling`, `lastColorLink`, `indexShow`, `dataDeCriacao`, `dataDeAtualizacao`, `workspaceTemplateId`.

Componente: `id`, `name`, `type` (ex.: `ME_OBJECTIVE_LIST`), `metadata` (JSON em string com `headerOptions` e `layout`).

Widget do Padrão: `code`, `nameBr`, `nameUs`, `descriptionBr`, `descriptionUs`, `idWidget`, `active`, `orderWidget`.
