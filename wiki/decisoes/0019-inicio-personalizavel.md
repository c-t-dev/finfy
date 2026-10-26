# 0019 — Início personalizável, com gráficos

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

## Contexto

A pessoa pediu uma Início personalizável, com a opção de adicionar gráficos. Antes disso, a Início tinha blocos fixos: saldo, este mês, para onde foi o dinheiro e últimos lançamentos. No Minhas Economias, o painel Padrão é travado e os painéis livres posicionam janelas em pixels ([paineis-e-widgets.md](../funcionalidades/paineis-e-widgets.md)), o que não funciona bem no celular.

## Decisão

Respostas da pessoa em 2026-10-26:

| Pergunta | Resposta |
| --- | --- |
| Quanto personalizar | Mostrar, ocultar e reordenar blocos, com largura metade ou inteira. Sem painéis livres |
| De quem é a disposição | De cada pessoa, por wallet. Quem só pode ver também personaliza a sua |
| Gráficos da primeira versão | Saldo ao longo do tempo e Receitas x despesas por mês |
| Biblioteca | Recharts, pelo componente Chart do shadcn/ui |
| Gráfico de patrimônio | Fica para depois: bens e dívidas não têm histórico de valores |
| Quantos meses à frente | Escolha em cada gráfico: 3, 6 ou 12 meses |
| Previsão depois de 90 dias | Simular as recorrências ativas, sem gravar nada |
| Aparece na Atividade? | Não. É preferência pessoal, fora da auditoria |

Regras:

- **Blocos:** `balance`, `month`, `balanceChart`, `cashflowChart`, `topExpenses`, `recent`. A chave nunca é renomeada nem reaproveitada.
- **Padrão:** todos os blocos, nessa ordem. Saldo e Este mês ficam com metade da largura, e os outros com a largura inteira. "Restaurar padrão" apaga a disposição salva.
- **Bloco novo em versão futura:** fica oculto para quem já personalizou e aparece em "Blocos ocultos". Chaves desconhecidas e repetidas são ignoradas na leitura.
- **Edição:** "Personalizar" abre o modo de edição. No computador, os blocos podem ser arrastados. Em qualquer tela, há setas, largura (Metade ou Inteira, só em telas largas) e Ocultar. Os ocultos aparecem embaixo, com "Adicionar". A mudança aparece na hora e é salva 400 ms depois da última. No celular, os blocos ficam sempre empilhados.
- **Saldo ao longo do tempo:** saldo das contas ativas no último dia de cada mês. A linha cheia vai até o mês atual. A linha tracejada é o previsto: começa no mês atual e segue pelos meses escolhidos em "Próximos", somando lançamentos pendentes, compras de faturas em aberto e ocorrências simuladas até o fim de cada mês. As regras são as do resultado acumulado do Extrato ([0018](0018-resultado-acumulado-do-extrato.md)).
- **Receitas x despesas:** receitas e despesas de cada mês até o atual, com as mesmas regras dos totais do Extrato. Compras no cartão contam no mês de vencimento da fatura ([0016](0016-competencia-das-faturas.md)). Depois do mês atual vêm os meses previstos, com barras mais claras: o que já está pago, as receitas e despesas pendentes e as ocorrências simuladas do mês. A dica diz "previsto" (pedido da pessoa em 2026-10-26: passar o mouse nos meses futuros). O resultado do período soma só até o mês atual.
- **Período:** em cada gráfico, "Histórico" (6 ou 12 meses) e "Próximos" (3, 6 ou 12 meses). A escolha não é salva.
- **Recorrências simuladas:** as recorrências criam lançamentos de verdade só até 90 dias à frente. Depois disso, os gráficos calculam na hora as ocorrências de cada recorrência ativa, com as mesmas datas da tela de recorrências. Nada é gravado. Só entram datas depois do horizonte de 90 dias, então nada conta duas vezes; uma ocorrência apagada dentro do horizonte continua apagada. No cartão, a ocorrência conta no vencimento da fatura e sai do saldo pela conta de pagamento. Recorrência de conta ou cartão arquivado fica de fora. Lançamentos avulsos futuros que não são recorrência só aparecem se já estiverem registrados.
- **Movimento reduzido:** os gráficos não animam ([0012](0012-motion.md)).

## Modelo de dados e API

- Tabela nova `home_layouts`, **não sincronizada** e sem auditoria. Campos: `user_id`, `wallet_id`, `widgets` (jsonb `[{ key, size }]`, só os visíveis, em ordem) e `created_at`/`updated_at`. É única por (`user_id`, `wallet_id`), e o ID é `deterministicId("home_layout", userId, walletId)`. Migração `0007_home_layouts`.
- `GET /api/wallets/:id/home/layout` e `POST /api/wallets/:id/home/layout`: qualquer membro. O POST substitui a lista (a última escrita vale); `widgets: null` volta ao padrão.
- `GET /api/wallets/:id/home/insights?month=AAAA-MM&months=6|12&ahead=3|6|12`: qualquer membro. Devolve os meses, do mais antigo ao mais novo, com `incomeMinor`, `expenseMinor`, `pendingIncomeMinor`, `pendingExpenseMinor`, `forecastIncomeMinor`, `forecastExpenseMinor` (simulados), `balanceMinor` e `projectedMinor`. Usa a mesma consulta do Extrato (`selectStatementTotals`), mês a mês. O mês atual vem do relógio da pessoa.

Detalhes do código em [codebase.md → Home](../finfy/codebase.md#home).

## Diferenças em relação ao Minhas Economias

- A Início padrão não é travada: dá para personalizar sem criar um painel novo.
- Os blocos ficam numa grade que se ajusta à tela, e não em janelas posicionadas em pixels.
- Cada membro de uma wallet compartilhada tem a sua Início.

## Perguntas em aberto

- Nos apps nativos (offline), a disposição vai sincronizar? Se sim, `home_layouts` precisa entrar na publicação e nas regras de sync (hoje a tabela não tem `version` nem `archived_at`). Se não, fica guardada só no aparelho.
- Gráfico de patrimônio: exige histórico de valores de bens e dívidas, ou fotos mensais.
- Outros blocos (contas, cartões, objetivos, orçamento) e salvar o período escolhido em cada gráfico.
