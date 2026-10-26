# Histórico de testes

> Última atualização: 2026-10-26

Registro cronológico de testes locais e no app real. Mais recente primeiro.

## 2026-10-26 — finfy: vínculo entre bens e dívidas

Teste de integração dos comandos com Postgres local e banco descartável `finfy_test_patrimony_*`, criado, migrado e removido pelo teste. Cobre criação vinculada, edição pelos dois lados, múltiplos vínculos, remoção/restauração da mesma linha, bloqueio de VIEWER e de usuário externo, referências a outra wallet, autorreferência, idempotência, conflito de versão, arquivamento e patrimônio sem duplicação. Teste de contrato cobre lista omitida, substituição, remoção e IDs repetidos/inválidos. Nenhum dado de produção ou do banco de desenvolvimento alterado. Checagem de tipos, 16 testes da suíte padrão, paridade das 883 mensagens e OpenAPI passaram. O teste de integração passou também com edições simultâneas e recomputação de toda a cadeia de hashes da auditoria. Sem teste visual no navegador nesta tarefa.

## 2026-10-26 — finfy: competência das faturas

Regressão automatizada com tabelas sintéticas em SQLite em memória: SQL de competência, fechamento e vencimento no mesmo mês e em meses diferentes, virada de ano, compra em 6/out alocada em novembro, três parcelas de 26/out alocadas de dezembro a fevereiro e pagamento antecipado sem duplicar gasto. Data original preservada. Os 15 testes passaram; typecheck, check:messages e check:openapi passaram. OpenAPI regenerado para o campo opcional statementDate. Revisão das telas: título pelo vencimento salvo, navegação pelos ciclos existentes, lista de cartões pelo ciclo atual, Home pelo mesmo endpoint, planejamento e alertas pelo mesmo SQL. Sem teste visual nesta tarefa e sem acesso a banco real.

## 2026-10-26 — finfy local: prestações por recorrência

Antes do merge, repetidas as quatro verificações obrigatórias com sucesso e executado `pnpm build`: build de produção concluído, incluindo páginas independentes e interceptadas de autenticação. Nenhuma migração necessária.

No Extrato, aberto "Novo lançamento" sem salvar dados. Ao escolher "Todo mês", conferidos "Valor da parcela", "Primeiro vencimento", aviso do dia mensal e opções de término. Com quantidade 36 e início em 2026-10-26, a prévia mostrou último vencimento em 2029-09-26, incluindo o ano. Nenhum lançamento criado.

Teste automatizado cobre uma parcela, 36 parcelas, mês curto com retorno ao dia original, ano bissexto, frequência semanal e quantidades inválidas. Tipos, 14 testes, paridade das 876 mensagens e OpenAPI passaram. Após ajustar a apresentação da data final, tipos do pacote do app passaram novamente.

## 2026-10-26 — finfy local: janela de login

Conexão local: configurado o app para o Postgres Docker em localhost, sem executar migrações ou alterar dados existentes. `/api/health` retornou `status: ok` e `database: ok`. Cadastro local aberto e conferido no navegador sem exigir convite. Nenhuma conta foi criada neste teste.

Página independente: conferidos link "Voltar para a Home" e rodapé público no acesso direto ao login. O link retornou à Home no mesmo idioma. Tipos e paridade das 863 mensagens passaram.

Rotas paralelas: acesso direto ao login mostrou formulário independente; pela Home, "Abrir o finfy" abriu a janela interceptada. Voltar retornou à Home, Avançar reabriu a janela e recarregar mostrou o login independente. Após ajustar a URL da minimização, testado amarelo mostrando o endereço da Home e "Abrir o finfy" restaurando o endereço do login com o campo de teste preservado e focado. Tipos, 13 testes, mensagens e OpenAPI passaram.

Após o ajuste dos links da Home, testado minimizar e clicar em "Open finfy": a janela existente foi restaurada, a URL de login permaneceu igual e o campo preenchido foi preservado. Tipos do pacote do app passaram.

Na prévia local, verificado o amarelo minimizando a janela e revelando a Home, com foco no botão verde de restaurar. Ao restaurar, o campo preenchido com um marcador de teste continuou preenchido e recebeu foco. Nenhum formulário foi enviado. Conferido visualmente o fundo desfocado e escurecido atrás da janela. Tipos, 13 testes, mensagens e OpenAPI passaram; após o ajuste de fundo, os tipos do pacote do app passaram novamente.

## Método

- Navegador Brave com a conta de teste logada pelo Google, controlado pela extensão Claude in Chrome.
- O portal é Flutter em canvas, então a navegação é por cliques e capturas de tela.
- Uma interceptação de `fetch` e `XMLHttpRequest` injetada na página registrou método, URL, corpo e resposta de cada chamada à API. Só a estrutura das respostas foi copiada, sem dados pessoais.

## 2026-10-25 — rodada 3: edições, objetivos e painéis

Salvos: membro, bem, objetivo com depósito, limite por categoria, categoria nova, subcategoria, edição de regra, edição de recorrência, painel personalizado com 2 componentes, mover componente. Visto: filtros do Extrato aplicados no navegador; exportação de planilha sem arquivo.

Achados: taxa do objetivo ignorada; edição de regra não reaplicou; edição de recorrência não refletiu na hora e deixou a faixa de valor errada; painéis personalizados escondem o menu lateral.

## 2026-10-25 — rodada 2: tipos de transação, contas e cartões

Salvos: ganho, transferência, gasto parcelado (3x), conta manual, cartão manual. Visto: visão Calendário do Extrato.

Achados: o bug da tag se repete com tag existente; transferência vira duas transações; parcelado é dividido no servidor; API aceita saldo inicial que a tela não tem; "Apagar transação" apaga sem confirmação (a transação original "[TESTE] Lanche" foi apagada assim, sem querer); não existe botão "ignorar".

## 2026-10-25 — rodada 1: transação, recorrência e regra

Salvos: gasto à vista com tag, edição da tag, recorrência mensal a partir do gasto, regra de categorização, revisão de transação.

Achados: tag perdida no cadastro; recorrência duplica o gasto; gastos e saldo discordam; regra aplicada na cópia em vez do original.

## 2026-10-25 — leitura completa

Todas as telas e formulários abertos sem salvar; cerca de 40 endpoints de leitura mapeados; catálogo de bancos, migração, Ajuda e Meu Clube inspecionados.
