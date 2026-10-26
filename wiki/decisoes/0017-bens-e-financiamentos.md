# 0017 — Associar bens às dívidas de financiamento

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

## Contexto

A pessoa pediu implementar o vínculo entre uma casa ou carro financiado e sua dívida. O modelo aprovado já contém `asset_liabilities`, com unicidade do par e referências à mesma wallet. O valor estimado do bem e o saldo restante da dívida continuam independentes.

## Decisão

- Usar a tabela existente. Preservar a cardinalidade que ela suporta: várias dívidas por bem e vários bens por dívida, sem ratear valores entre os vínculos.
- Permitir selecionar, alterar e remover associações no cadastro e na edição de ambos. Mostrar nomes e valores associados na lista, inclusive para quem só pode consultar.
- O vínculo liga um registro `ASSET` a um `LIABILITY` da mesma wallet. Não há restrição adicional de tipo além das já existentes no cadastro.
- O patrimônio soma cada bem e subtrai cada dívida uma única vez, pela participação informada. O vínculo não muda valores nem o cálculo.
- A prestação por recorrência continua conforme [0014](0014-prestacoes-por-recorrencia.md): pagar não amortiza a dívida automaticamente. Não implementar projeção de valorização ou depreciação.

## Implementação

As associações usam o mesmo comando, transação, permissão `editEntries` e mutação do cadastro. Alterar associações exige a versão atual; ambos os lados recebem nova versão quando o vínculo muda. Arquivar um cadastro preserva os vínculos para consulta e restauração. A interface identifica o associado arquivado, permite removê-lo e não oferece novos vínculos com cadastros arquivados.

Cada vínculo usa ID determinístico do par. Remover arquiva a linha; associar de novo restaura a mesma linha. Mudanças entram na auditoria de `asset_liabilities` e nos cadastros afetados. A tabela já está publicada para PowerSync; o cliente nativo e o push ainda não existem.

## Modelo e API

Sem alteração de esquema. `linkedIds` é opcional no POST/PATCH de bens: omitido preserva vínculos; uma lista substitui; `[]` remove todos. As respostas incluem `linkedIds` e `linkedAssets` com contexto de consulta. Ver [codebase](../finfy/codebase.md#patrimony) e [modelo](../finfy/data-model.md).

## Referências e perguntas

O Minhas Economias expõe `creditOperationIds` no payload de bens, mas esse contrato não é reutilizado. O finfy segue o próprio modelo aprovado. Não há pergunta de produto pendente para este vínculo informativo; amortização automática, rateio e histórico de avaliação ficam fora deste trabalho.
