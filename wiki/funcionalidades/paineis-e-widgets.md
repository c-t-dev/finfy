# Painéis e widgets

> Última atualização: 2026-10-25

O Início é o painel "Padrão", feito de widgets fixos. O usuário também pode criar painéis próprios, onde componentes viram janelas livres posicionadas na tela.

## Painel Padrão (Início)

Widgets ativos (`GET /api/workspaces/home/widgets/settings/active`), cada um com `code`, nome, descrição, `active` e `orderWidget`:

| Código | Widget |
| --- | --- |
| `COD_ME_BALANCE` | Saldo (com gráfico e "Ver Detalhes") |
| `COD_ME_CATEGORY` | Gastos por categoria |
| `COD_ME_LATEST_TRANSACTIONS` | Últimas transações |
| `COD_ME_ACCOUNTS` | Contas Bancárias |
| `COD_ME_CARDS` | Cartões de Crédito |
| `COD_ME_GOALS` | Objetivos |
| `COD_ME_MEMBERS` | Membros |
| `COD_ME_PATRIMONY` | Patrimônio |

Os widgets se reorganizam sozinhos em colunas (layout de alvenaria) conforme têm conteúdo. O layout "Padrão" tem cadeado; "Adicionar componentes" não faz nada nele, sem aviso. Arrastar widgets no Padrão não muda nada.

## Painéis personalizados

"+ Adicionar" → "Começar do zero" pede o nome do painel direto na barra superior ("Novo nome"), sem tela de explicação. Depois abre o catálogo "Componentes".

- Criar: `POST /api/workspaces/create` com `name`, `type: ANY_WHERE`, `active`, `visible`, `lastColorLink`. Resposta com `components[]`, `locked: false`, `smart_tilling: false`.
- Listar: `GET /api/workspaces/list`.
- No painel personalizado o menu lateral some; a tela inteira é área livre. Volta-se ao Padrão pelo seletor na barra superior.
- O botão "Componentes" na barra superior reabre o catálogo.

### Catálogo de componentes (31 em 7 abas)

| Aba | Componentes |
| --- | --- |
| Visão geral | Resumo, Saldo e projeção, Saldo atual |
| Contas e cartões | Contas Bancárias, Poupança, Cartões de Crédito, Patrimônio Geral, Meus cartões, Meus bens |
| Movimentações | Extrato, Gráfico do extrato, Resumo do mês, Transações frequentes, Calendário de transações |
| Gastos e ganhos | Meus Gastos, Meus Ganhos, Gastos por Categoria, Ganhos por Categoria |
| Investimentos | Dashboard de Investimentos, Meus Investimentos, Todos os Investimentos, Renda Fixa, Renda Variável, Tesouro Direto, Fundos |
| Patrimônio | Resumo do patrimônio, Ativos, Passivos |
| Planejamento | Lista de Objetivos, Objetivos Concluídos, Membros |

Selecionar vários e "Concluir" cria um `POST /api/workspaces/components` por componente, com `workspace_id`, `name`, `type` (ex.: `ME_OBJECTIVE_LIST`) e `metadata` (JSON em string) com `headerOptions.color_link` e `layout` (`left`, `top`, `width`, `height`, `index`, `is_maximized`).

### Janelas

- Cada componente é uma janela com título, botões no cabeçalho (maximizar, fechar) e borda.
- Arrastar pelo cabeçalho move a janela: `PUT /api/workspaces/components/{uuid}/metadata` com o novo `layout` (204). As coordenadas salvas são maiores que as da tela (**inferido:** em pixels físicos).
- O Calendário de transações mostra o saldo de cada dia com legenda (positivo, negativo, neutro).
