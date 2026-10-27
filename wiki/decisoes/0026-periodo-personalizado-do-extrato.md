# Período personalizado do Extrato

> Última atualização: 2026-10-27
> Status: Aceita

## Decisão

Usuário aprovou pesquisar por datas inicial e final, inclusive entre meses. Manter navegação mensal e adicionar Período personalizado com campos de data e aplicação explícita. Intervalo de um único dia é válido. Rejeitar datas invertidas sem mudar o período aplicado. Voltar ao mês completo ou usar setas retorna à navegação mensal.

Receitas e despesas respeitam o intervalo inclusivo, os filtros e as pendências já incluídas. Resultado acumulado mantém histórico e saldo anterior até a data final; apenas filtro de conta aplica-se ao acumulado. A explicação mostra a data final exata. Compras de cartão continuam pelo vencimento salvo da fatura. Sem mudança financeira, API nova ou migração: as consultas existentes já aceitam from/to.

## Validação

Teste React de intervalo entre meses, dia único, intervalo invertido sem consulta e retorno ao mês. Resumo e lista continuam independentes.

## Interação e calendário

Usuário solicitou animar tanto abertura quanto fechamento e substituir o calendário nativo por componente reutilizável no padrão iOS/macOS. Calendar e DatePicker vivem em packages/ui, usando DayPicker para navegação por teclado e Radix Popover para foco, Escape e posicionamento. Tokens do app, seleção circular azul, superfícies translúcidas, rótulos pt-BR/en e botão Hoje. Datas são locais, sem conversão UTC. O formulário usa Motion para altura e opacidade, com fade discreto quando movimento é reduzido.

Após revisão visual, calendário compacto no computador: células de 32 px e espaçamento menor; dispositivos de toque mantêm células de 40 px.
