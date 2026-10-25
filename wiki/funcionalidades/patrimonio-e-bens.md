# Patrimônio e bens

> Última atualização: 2026-10-25

Patrimônio líquido = ativos (saldos das contas, investimentos e bens) menos passivos (dívidas e cartões). O cálculo é feito no servidor.

## Meu Patrimônio (`/account/show_list`)

- Cartão "Patrimônio": total, ativos e passivos.
- "Meus Ativos": composição em gráfico.
- "Ver meus investimentos": carteira de investimentos.
- Contas Bancárias com saldo de cada uma.
- Convite "Quer ter uma visão completa?" para cadastrar bens.

API: `GET /financial-core/v1/patrimony/composition` (opcional `categories=ACCOUNTS|CREDIT_CARDS`) devolve `netWorth`, `totalAssets`, `totalDebts`, `assets.sections[]`, `debts.sections[]`, `investmentIsStale` e `compositionDate`. `GET /financial-core/v1/suggestion` alimenta sugestões.

## Investimentos

`GET /financial-core/v1/investments/positions` devolve `categories[]`, `totalInvestmentValue`, `isStale`, `archivedCount`. Investimentos só entram por conexão bancária; não há cadastro manual ("Adicionar" leva ao catálogo de bancos).

## Meus Bens (`/patrimony-assets`)

Formulário "Registrar Bens":

| Campo | Observação |
| --- | --- |
| Nome (obrigatório) | |
| Tipo (obrigatório) | grupo → tipo (tabela abaixo) |
| Cor (obrigatório) | paleta de 18 cores |
| Valor atual (obrigatório) | "Quanto vale hoje" |
| Valor na compra | "Quanto foi pago" |
| Data da compra | datas futuras bloqueadas |
| Observações | texto livre |

| Grupo | Tipos |
| --- | --- |
| Veículos | Carro, Moto, Caminhão, Barco, Bicicleta, Avião, Máquina agrícola, Patinete, Outros |
| Propriedades | Casa, Apartamento, Terreno, Sítio, Vaga de garagem, Galpão, Multipropriedade, Fazenda, Móveis de casa, Outros |
| Eletrônicos | Computador, Notebook, Smartphone, Tablet, TV, Câmera, Drone, Console, Smartwatch, Eletrodoméstico, Outros |
| Empresas | Participação societária, Terreno comercial, Ponto comercial, Galpão comercial, Equipamento, Estoque, Outros |
| Colecionáveis | Ouro, Joias, Obra de Arte, Relógio de Luxo, Prata, Cobre, Moedas, Vinho, Cartas, Antiguidades, Instrumento Musical, Equipamento Esportivo, Selos, Acessórios, Outros |
| Direitos | Consórcio, Precatório, Patente, Crédito a receber, Herança, Título de Clube, Domínio, Royalties, Outros |

Salvar: `POST /financial-core/v1/patrimony/assets` (201). A API tem campos que a tela não mostra: `depreciationRate` (1.0), `creditOperationIds` (dívidas ligadas ao bem, de `GET /financial-core/v1/credit-operations/options`). A resposta traz `debtPosition` com `netValue`, `outstandingDebtTotal` e `ownershipPercentage`. A data vai em ISO e volta como dd/mm/aaaa.

Depois de salvo, a tela mostra "Detalhe do bem" com edição inline e "Apagar bem".

Tipos: `GET /financial-core/v2/patrimony/asset-types` (grupos com `code`, ex.: `VEHICLE`, e tipos, ex.: `CAR`; Notebook = `idTypeCode` 10).
