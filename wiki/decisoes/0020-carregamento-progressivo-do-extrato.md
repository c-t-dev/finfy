# Carregamento progressivo do extrato

> Última atualização: 2026-10-27
> Status: Aceita

## Contexto

O usuário pediu que resumo e lançamentos apareçam assim que estiverem prontos, em qualquer ordem, sem esperar um pelo outro. Citou o comportamento de streaming da documentação do Next.js. A implementação foi autorizada na branch de trabalho atual, somente localmente.

## Decisão

- Resumo e lista iniciam requisições independentes. Cada bloco mantém skeleton, erro e tentativa novamente próprios.
- Nenhum bloco espera a conclusão do outro. Um erro não remove o conteúdo bem-sucedido do outro bloco.
- Trocar mês ou filtros carrega os dois blocos para o novo contexto. Alterar lançamentos ou gerar recorrências atualiza ambos.
- No cliente React compartilhado, implementar renderização progressiva com duas respostas JSON independentes. Não é um stream contínuo na rede nem exige componentes de servidor dentro de `packages/app`.
- O comportamento visual é equivalente ao objetivo de blocos independentes descrito pelo usuário. A separação preserva a arquitetura compartilhável com Tauri e Capacitor. `Suspense` sozinho não separa a requisição combinada existente.
- Preservar cálculo, filtros, competência de cartão, autorização por wallet e o endpoint combinado usado por outros consumidores.
- As duas leituras podem refletir instantes ligeiramente distintos se houver escrita concorrente. As mutações feitas pela tela recarregam ambos; não há snapshot único entre duas requisições independentes.

## API

| Endpoint de leitura | Resposta | Trabalho executado |
| --- | --- | --- |
| `GET /api/wallets/{id}/transactions/entries` | `{ entries }` | Lançamentos e detalhes de exibição; não calcula totais |
| `GET /api/wallets/{id}/transactions/summary` | `{ summary }` | Totais; não busca linhas, tags ou detalhes de transferências/pagamentos |

Ambos exigem sessão e participação na wallet. Aceitam `from`, `to`, `accountId`, `categoryId`, `tagId` e `q`, com as mesmas regras do endpoint combinado. Schema compartilhado e OpenAPI atualizados. Sem mudança no banco.

## Validação

Tela React testada com respostas controladas em DOM isolado: resumo primeiro, lista primeiro, falhas isoladas, retry sem recarregar a parte bem-sucedida e mudança de mês. Consultas e conversor do resumo testados em PostgreSQL descartável com migrações reais. Sem dados pessoais nos testes.
