# Histórico de alterações

> Última atualização: 2026-11-06

Mudanças em desenvolvimento ficam em **Não publicado**. Ao confirmar uma publicação, consolidar versão e data conforme a decisão 0015.

## Não publicado

### Melhorias

- Preparação local do OTP por e-mail com modelos em português e inglês, transporte de teste em memória e processamento de fila com reenvio limitado, expiração e limpeza dos códigos. O envio real e a exigência de verificação continuam desativados.

## v0.3.2 — 2026-11-06

### Correções

- Cartões mostram o total em aberto da próxima fatura, incluindo lançamentos com data futura. Removida a linha “Apenas previsão”; valores de faturas vencidas seguem a mesma regra.

## v0.3.1 — 2026-11-06

### Correções

- Edição de compras no cartão permite alterar valor total e data original, redistribuindo todas as parcelas sem apagar a compra. Faturas pagas precisam ser reabertas antes da alteração financeira.

## v0.3.0 — 2026-11-06

### Funcionalidades

- Carregamento progressivo com skeletons e recuperação de erro por bloco nas páginas de dados e listas arquivadas. Resumo e lista do Extrato, Home e faturas aparecem independentemente; cartões não esperam pelas contas. Respeita movimento reduzido e leitores de tela.
- Extrato com período personalizado, inclusive entre meses ou para um único dia. O resultado acumulado informa a data final escolhida.
- Calendário reutilizável com visual iOS/macOS, navegação por teclado, botão Hoje, traduções e tamanho compacto. O formulário de período anima abertura e fechamento.
- Bens e dívidas ganha página e acesso direto no menu, após Contas e cartões. Patrimônio líquido permanece como indicador.
- Controles de janela exclusivos da web: botão laranja minimiza com a Home pública ao fundo; botão verde maximiza e restaura com triângulos no estilo macOS. Transições respeitam movimento reduzido e preservam tela, campos e foco.

### Melhorias

- Autorizações compartilhadas passam a usar CASL, preservando os papéis e as permissões existentes.

- Contas e cartões destaca a próxima fatura com compras realizadas e mostra vencidas e previsões separadamente. Limite e parcelas futuras ficam nos detalhes do cartão.
- Home e Extrato incluem pendências nos valores mensais de receitas e despesas, sem duplicar compras e pagamentos de cartão. O saldo das contas permanece confirmado.
- Títulos explicam o escopo dos valores. Configurações agrupa carteira e compartilhamento, organização dos lançamentos, acesso pessoal e administração.
- A Home personalizável, os gráficos com projeções e a correção de exclusão existentes no GitHub foram preservados na integração.

### Correções

- Teste do período do Extrato não depende mais do mês atual para validar o retorno ao mês completo.

- Troca de senha impede que logins antigos em andamento criem sessões ou sobrescrevam a nova credencial. Alteração, revogação e auditoria são atômicas.
- Códigos de e-mail respeitam o limite de tentativas e uso único mesmo com verificações simultâneas; envio de e-mail continua desativado.
- Repetições de operações de membros e faturas verificam acesso atual à carteira; membros removidos não recebem metadados por repetição de operações de carteira.
- Tentativas simultâneas de login incrementam o contador de falhas atomicamente, preservando o bloqueio da conta.
- Limite usado e patrimônio excluem gastos futuros previstos, mantendo parcelas futuras de compras já realizadas como dívida.
- Desenvolvimento no Windows usa Webpack para evitar o ciclo de recompilações observado com Turbopack. Traduções usam caminhos explícitos compatíveis com Webpack.
- Desenvolvimento reutiliza o pool do banco entre atualizações do código, evitando esgotar conexões.

### Validação

- 50 testes aprovados; sete cenários de autenticação também validados em PostgreSQL 17 local.
- Typecheck, traduções, OpenAPI e build de produção aprovados.
- Sem alteração de esquema ou migração de banco.

## Versões anteriores

Identificadas pelas tags do Git. Suas notas não foram reconstruídas neste histórico.
