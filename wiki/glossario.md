# Glossário

> Última atualização: 2026-10-25

| Termo | Significado |
| --- | --- |
| Gasto / `GASTO` | Saída de dinheiro. `typeTransaction` da API. |
| Ganho / `GANHO` | Entrada de dinheiro. |
| Transferência | Movimento entre duas contas do usuário. Vira duas transações espelhadas. |
| Consolidada (`isConsolidated`) | Transação efetivada, que entra no saldo. Ocorrências geradas por recorrência ficam `false` e não entram no saldo. |
| Pendente / Confirmada / Ignorada | Situações de transação usadas nos filtros (`statuses=[CONFIRMED, PENDING]`). |
| Revisada (`is_review`) | Transação que o usuário marcou como conferida no fluxo de revisão. |
| Projeção (`projected`) | Valor futuro calculado a partir de recorrências, parcelas e faturas. |
| Recorrência | Cadastro que gera lançamentos repetidos (ex.: aluguel mensal). |
| Regra de transação | Categorização automática: condições → ações. Não cria lançamentos. |
| Categoria interna (`isInternal`) | Categoria de sistema que o usuário não escolhe: Ajuste de Saldo, Fatura, Interna, Investimento. |
| Carteira (`CARTEIRA`) | Conta "Minha Carteira", criada por padrão como conta principal. |
| Conta principal (`main`) | Conta que já vem selecionada ao registrar transação. |
| Fatura | Conjunto de gastos de um cartão entre duas datas de fechamento. |
| Limite (orçamento) | Valor máximo mensal de gasto numa categoria, com alerta em %. |
| Objetivo | Meta financeira com valor, prazo e depósitos. |
| Membro | Pessoa da família associada a transações. Não tem login próprio. |
| Bem | Item de patrimônio (imóvel, veículo etc.) com valor atual e de compra. |
| Painel / workspace | Tela de componentes. "Padrão" é o Início; outros são criados pelo usuário. |
| Componente / widget | Bloco de um painel (ex.: Lista de Objetivos). |
| Meu Clube | Plano pago. |
| Open Finance | Padrão do Banco Central para compartilhar dados bancários. O app usa o conector `LINA`. |
| MCP | Model Context Protocol. O app tem um servidor MCP para assistentes de IA. |
