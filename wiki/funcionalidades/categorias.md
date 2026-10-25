# Categorias

> Última atualização: 2026-10-25

Cada gasto e ganho tem uma categoria obrigatória e, opcionalmente, uma subcategoria. Há categorias padrão, categorias internas de sistema e categorias criadas pelo usuário.

## Onde fica

Avatar → Categorias ("Minhas categorias"): abas Gasto e Ganho, busca, ordenação A–Z ou Mais usadas, e cada categoria expande para mostrar as subcategorias.

## Categorias padrão de gasto

| Categoria | Subcategorias |
| --- | --- |
| Alimentação | Açougue, Cafeteria e Lanchonete, Delivery, Feira, Padaria, Restaurante, Supermercado |
| Assinaturas | Aplicativo, Game, Música, Streaming, Televisão |
| Casa | Água, Aluguel/Prestação, Condomínio, Energia, Funcionários, Gás, Internet, IPTU, Lavanderia, Manutenção, Objetos de casa, Seguro, Telefone/Celular |
| Dívidas | Cartão de crédito em atraso, Cheque especial, Empréstimo, Financiamento, Tributos atrasados |
| Educação | Cursos, Escola e Faculdade, Livros e materiais, Uniformes |
| Empresarial | COFINS, CSLL, Despesas Gerais Médias, INSS, IR, ISS, Mensalidade Contador, PIS |
| Lazer | Bares, Boates e festas, Cinema, Livrarias, jornais e revistas, Passeio, Teatro |
| Objetivos de vida | Aposentadoria, Metas pessoais |
| Outros | — |
| Pessoal | Academia, Acessórios, Cabelereiro, Cosméticos, Doações e dízimos, Esportes, Higiene pessoal, Mesadas, Pensões, Presentes, Seguro de vida, Seguros diversos, Vestuário |
| Pet | Acessórios, Alimentação, Banho e Tosa, Medicamentos, Veterinário |
| Saúde | Academia, Consultas e sessões, Dentista, Esportes, Exames, Farmácia, Médico, Plano de saúde, Terapias |
| Serviços | Advogado, Cartório/Correios, Manutenção e reparos |
| Taxas | Anuidade cartão, Carne leão, COFINS, Encargos, Gorjetas, Imposto de renda, INSS, ISS, PIS, Tarifa bancária |
| Transferências | Aplicação automática |
| Transporte | Combustível, Estacionamento, IPVA, Licenciamento, Limpeza, Manutenção, Multas, Pedágio, Prestação, Prestação/Aluguel, Seguro, Táxis e Aplicativos, Transporte público |
| Vestuário | — |
| Viagem | Hospedagens, Passagens, Passeios |
| Antiga experiência | — (dados migrados da versão antiga) |

## Categorias padrão de ganho

| Categoria | Subcategorias |
| --- | --- |
| Cashback | — |
| Outros | — |
| Prêmio | Bônus, Distribuição de Lucro |
| Presente | — |
| Receitas Variáveis | 13º Salário, Ajuda de Custos, Comissões, Empréstimos, Férias, Notas Fiscais emitidas, Reembolso, Restituição de Imposto, Seguros |
| Salário | Aposentadoria, Benefício alimentação, FGTS, Pensões, Pró-Labore, Salário |
| Transferências | Lançamento entre contas, Resgate, Resgate automático |

## Categorias internas

`isInternal: true`, não aparecem no formulário de transação: **Ajuste de Saldo**, **Fatura**, **Interna**, **Investimento** (gasto: Aplicação; ganho: Juros, Proventos, Rendimentos, Resgate). A saída de transferência usa a categoria interna `1000002`.

IDs vistos: 1 = Salário, 6 = Alimentação, 7 = Casa, 11 = Lazer; subcategoria 1000018 = Objetos de casa.

## Criar categoria

Na busca de categorias, quando nada é encontrado, aparece "Nova categoria". O formulário pede nome, tipo (Gasto/Ganho), ícone (24 opções) e cor.

`POST /financial-core/v1/categories` → a nova categoria vem com `flagEdit: true` (as padrão têm `false`).

## Criar subcategoria

Expandir a categoria → "Nova subcategoria em <categoria>" → digitar o nome e confirmar.

`POST /financial-core/v1/sub/categories` com `idCategory` e `subCategoryName`. Subcategorias do usuário ganham ícones de editar e apagar; as padrão, não.

## Ordenação

A busca usa `transactionCount`, `transactionCountPeriodDays` e `priorityScore` de cada categoria para ordenar por "Mais usadas".
