# Carregamento progressivo nas páginas do app

> Última atualização: 2026-10-27
> Status: Aceita

## Contexto

Após aprovar o extrato progressivo, o usuário pediu o mesmo padrão em todas as páginas. A implementação continua na branch de trabalho local, sem publicação.

## Decisão

- Blocos com fontes independentes iniciam suas leituras sem esperar os demais. Cada bloco mostra skeleton, erro e tentativa novamente próprios.
- A Home separa resumo mensal e lançamentos. Saldo das contas e categorias continuam como recursos independentes.
- Em Contas, cartões e patrimônio começam a carregar mesmo enquanto a lista de contas está pendente. Formulários que precisam de contas aguardam esses dados; não se mostra a orientação de criar conta antes de saber que a lista está vazia.
- A fatura separa resumo e compras. Cada parte pode chegar primeiro e falhar sem esconder a outra. Pagamento, reabertura e edição atualizam as duas partes.
- O detalhe de uma meta pode exibir o resumo já conhecido na lista enquanto busca seu histórico. O resumo atualizado substitui o anterior quando chega. Histórico pendente ou com erro não é mostrado como vazio.
- Planejamento, metas, categorias, tags, recorrências, regras, atividade, membros, convites, patrimônio e notificações usam skeletons em suas leituras. Listas arquivadas também têm carregamento e erro próprios.
- Conteúdo estático e formulários já disponíveis permanecem visíveis. Ações de salvar, excluir, pagar e autenticar mantêm indicadores de ação, sem skeleton sobre o formulário.
- Dados derivados de uma mesma coleção continuam compartilhando a leitura necessária para calculá-los, como os valores de orçamento por categoria. Não duplicar a consulta apenas para simular ordem de chegada.
- Ao mudar o caminho de um recurso, não pintar dados da wallet, mês ou entidade anterior enquanto começa a nova leitura. Refresh do mesmo caminho preserva conteúdo já carregado.
- Reutilizar rótulos traduzidos e respeitar movimento reduzido. Shapes de skeleton são decorativos; o estado de carregamento e os erros são acessíveis.

## API e limites

A leitura da fatura aceita `part=summary` (resposta `{ invoice }`) e `part=purchases` (resposta `{ purchases }`). Sem `part`, a resposta combinada existente permanece. Ambas as partes verificam sessão e participação na wallet. OpenAPI e schemas compartilhados atualizados.

Renderização progressiva usa recursos React independentes, conforme [0020](0020-carregamento-progressivo-do-extrato.md), sem stream contínuo de rede. Duas leituras não são um snapshot único durante escritas concorrentes. Sem alteração de tabelas ou regras financeiras.
