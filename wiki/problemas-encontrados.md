# Problemas encontrados

> Última atualização: 2026-10-27

Bugs, inconsistências e riscos observados nos testes. Úteis como lista do que **não** repetir no finfy.

## Bugs

| # | Problema | Como reproduzir | Impacto |
| --- | --- | --- | --- |
| 1 | Tag escolhida no cadastro não é salva | Registrar transação com uma tag (nova ou existente) | O corpo vai com `tags: null`; a transação fica sem tag |
| 2 | Recorrência duplica o gasto de origem | Detalhes de um gasto → Recorrências → Criar | Gera uma segunda transação no mesmo dia em vez de vincular a original |
| 3 | Gastos e saldo discordam | Após o item 2 | A cópia (`isConsolidated: false`) entra em Meus Gastos (R$ 25) mas não no saldo (−R$ 12,50) |
| 4 | Regra aplicada na transação errada | Criar regra cuja prévia lista o gasto original | Quem muda de categoria é a cópia da recorrência; o original fica igual |
| 5 | Edição de regra não reaplica | Trocar a categoria de destino com histórico ligado | Nenhuma transação muda |
| 6 | Edição de recorrência deixa a faixa de valor errada | Mudar valor de 12,50 para 15,00 | `valueBegin` fica 11,25 e `valueEnd` vira 16,50 |
| 7 | Edição "Daqui pra frente" não muda a ocorrência de hoje | Editar valor da recorrência | Ocorrência de hoje continua com o valor antigo (processo assíncrono) |
| 8 | Taxa do objetivo ignorada | Criar objetivo de Poupança/Aposentadoria | `typeGoalFee: 7.45` mas `fee: 0`; parcela mensal sem rendimento |
| 9 | Exportar planilha sem arquivo | Extrato → ícone de planilha | Gera `data:` no navegador, mas nenhum arquivo apareceu |
| 10 | Calendário abre no mês errado | Extrato → Calendário | Abre no último mês projetado, não no atual |
| 11 | Clique no dia não filtra | Calendário → clicar num dia | A lista continua mostrando todos os meses |
| 12 | Formulário perde o que foi digitado | Abrir "Registrar transação" e digitar logo | Campos preenchidos durante o carregamento são descartados |
| 13 | Campo de valor concatena | Editar um valor existente | Ctrl+A não seleciona; "1500" sobre 12,50 virou 125.015,00 |
| 14 | Rota direta volta ao Início | Abrir `/cash_flow/` pela barra de endereço | Deep link não funciona |
| 15 | 503 no primeiro carregamento | Abrir o portal | `cash-flow/chart`, `accounts`, `patrimony/composition` e `onboarding-status` às vezes respondem 503 |

## Riscos de UX

- **Apagar sem confirmação:** "Apagar transação" executa na hora. Há botões parecidos em "Apagar bem", "Excluir regra" e "Apagar" na recorrência (não testados).
- "Adicionar componentes" no painel Padrão não faz nada e não explica por quê.
- "Começar do zero" pede só um nome na barra superior, sem contexto.
- O ícone de olho nos detalhes da transação parece "ignorar", mas só esconde valores.
- Regras atingem transferências, e o seletor de categoria da regra mostra categorias internas.
- O nome do membro remove caracteres especiais sem avisar.
- Meu Clube anuncia regras de categorização como recurso pago, mas elas funcionam no gratuito.

## Inconsistências de API

- Mistura de camelCase e snake_case: `is_review`, `budget/category` (`category_id`, `year_month`, `monthly_limit`, `alert_percentage`), `workspace_id`, `smart_tilling`.
- `cutoffDate` no envio x `cutOffDate` na resposta.
- Regras: `status` enviado como `ACTIVE` e gravado como `AT`; operador `EQUALS` volta como `=`.
- Datas de bem: ISO no envio, dd/mm/aaaa na resposta.
- Campo de interface vazando: `firstCharUppercase` no corpo de criar conta.
- Português e inglês misturados nos nomes (`dataDeCriacao`, `nameBr`).
- CDN de produção servindo de um caminho `cdn-dev.../dev/`.
- A hora enviada é ignorada: o servidor grava 12:00.

## finfy — regressão do extrato (2026-10-26)

Após v0.2.2, abrir o extrato falhava com "Não foi possível carregar os lançamentos". Logs confirmaram PostgreSQL `42702`, referência ambígua a `id`. A seleção de tabela única do Drizzle removia nomes de tabelas dentro do SQL de saldo, afetando os joins da projeção e a correlação por conta. Testes anteriores compilavam expressões isoladas em SQLite e não exerciam essa transformação. Correção: identificadores explicitamente qualificados; teste das consultas completas de produção em PostgreSQL em memória, com esquema migrado e dados sintéticos. Sem conexão ao banco real.
## finfy — recarga contínua no desenvolvimento Windows (2026-10-27)

Turbopack recompilava sem alteração de fonte, com sucessivos `Compiled in 0ms` e recargas de `/en`. Contorno adotado: Webpack no desenvolvimento. Imports de mensagens por caminhos literais corrigem a resolução de exports do pacote nesse bundler. Página local voltou a HTTP 200. Causa interna do ciclo no Turbopack não determinada.

## finfy — projeções no limite usado e patrimônio (2026-10-27)

Diagnóstico na cópia local autorizado pelo proprietário: `invoiceTotals` soma todas as compras não arquivadas/não canceladas de cada fatura. O limite utilizado soma esses totais de todas as faturas abertas; o patrimônio também soma compras de todas as faturas abertas, sem distinguir ocorrências futuras de recorrência. Assim, gastos ainda projetados afetam os números apresentados como limite usado e dívida de cartão. O patrimônio pode ficar negativo antes de essas compras ocorrerem. Não houve alteração de dados neste diagnóstico.

O total da fatura exibida e o limite usado têm escopos diferentes: o primeiro é só o ciclo atual de compras; o segundo soma todas as faturas abertas. Cada cartão pode ter vencimento em um mês diferente. Os saldos das contas seguem apenas movimentos pagos, conforme o modelo atual. Pergunta encaminhada ao usuário: excluir previsões futuras do limite usado e do patrimônio, mantendo parcelas de compras já realizadas e as previsões no extrato. O usuário confirmou a separação. Correção local usa a regra da [0022](decisoes/0022-divida-realizada-e-previsoes-dos-cartoes.md): excluir compras futuras previstas e manter parcelas de compras já realizadas.
### 2026-10-27 — conexões no desenvolvimento

Recompilações locais recriavam o pool do banco porque o cache era apenas do módulo. Após várias atualizações, o banco recusava novas conexões. Cache global apenas em desenvolvimento mantém o pool entre hot reloads; reinício libera os pools antigos. Produção mantém pool por instância.
