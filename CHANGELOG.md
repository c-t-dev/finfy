# Histórico de alterações

> Última atualização: 2026-10-27

Mudanças em desenvolvimento ficam em **Não publicado**. Ao confirmar uma publicação, consolidar versão e data conforme a decisão 0015.

## Não publicado

### Funcionalidades

- Carregamento progressivo com skeletons e recuperação de erro por bloco nas páginas de dados e listas arquivadas. Resumo e lista do Extrato, Home e faturas aparecem independentemente; cartões não esperam pelas contas. Respeita movimento reduzido e leitores de tela.
- Extrato com período personalizado, inclusive entre meses ou para um único dia. O resultado acumulado informa a data final escolhida.
- Calendário reutilizável com visual iOS/macOS, navegação por teclado, botão Hoje, traduções e tamanho compacto. O formulário de período anima abertura e fechamento.
- Bens e dívidas ganha página e acesso direto no menu, após Contas e cartões. Patrimônio líquido permanece como indicador.
- Controles de janela exclusivos da web: botão laranja minimiza com a Home pública ao fundo; botão verde maximiza e restaura com triângulos no estilo macOS. Transições respeitam movimento reduzido e preservam tela, campos e foco.

### Melhorias

- Contas e cartões destaca a próxima fatura com compras realizadas e mostra vencidas e previsões separadamente. Limite e parcelas futuras ficam nos detalhes do cartão.
- Home e Extrato incluem pendências nos valores mensais de receitas e despesas, sem duplicar compras e pagamentos de cartão. O saldo das contas permanece confirmado.
- Títulos explicam o escopo dos valores. Configurações agrupa carteira e compartilhamento, organização dos lançamentos, acesso pessoal e administração.
- A Home personalizável, os gráficos com projeções e a correção de exclusão existentes no GitHub foram preservados na integração.

### Correções

- Limite usado e patrimônio excluem gastos futuros previstos, mantendo parcelas futuras de compras já realizadas como dívida.
- Desenvolvimento no Windows usa Webpack para evitar o ciclo de recompilações observado com Turbopack. Traduções usam caminhos explícitos compatíveis com Webpack.
- Desenvolvimento reutiliza o pool do banco entre atualizações do código, evitando esgotar conexões.

## Versões anteriores

Identificadas pelas tags do Git. Suas notas não foram reconstruídas neste histórico.
