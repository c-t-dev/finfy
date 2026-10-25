# Problemas encontrados

> Última atualização: 2026-10-25

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
