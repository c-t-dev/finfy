# Histórico de testes

> Última atualização: 2026-11-06

Registro cronológico de testes locais e no app real. Mais recente primeiro.

## 2026-10-26 — finfy local: bug ao apagar lançamento

Reproduzido no Chrome sem janela com uma conta sintética `[TESTE]`. No diálogo de edição, "Apagar" derrubava a tela com "Rendered fewer hooks than expected" (`EntryForm`, `packages/app/src/entry-form.tsx`). A confirmação retornava antes do `useEffect` que sugere categoria por regra, e o número de hooks mudava entre renderizações. Correção: a confirmação passou para depois de todos os hooks. Depois disso, apagar no Extrato e na Início respondeu 200 nos dois casos, sem erro no console. Na Início, os gráficos não se atualizavam depois de apagar, porque mostravam a despesa e o previsto antigos. Agora recarregam sempre que um lançamento é salvo ou apagado. Tipos, testes, mensagens e OpenAPI passaram.

## 2026-10-26 — finfy local: Início personalizável

Contas sintéticas `[TESTE]` no Postgres local do Docker, com a migração `0007_home_layouts` aplicada. Pela API: `home/insights` bateu com o Extrato (saldo de R$ 4.500,00 em outubro; previsto de R$ 4.050,00 em novembro com despesa pendente). Também foram recusados lista com bloco repetido, `months=7`, POST sem `Origin` (403) e wallet de outra pessoa (404). Restaurar o padrão funcionou, e a disposição não apareceu na Atividade. No Chrome sem janela: Início padrão, modo de edição (ocultar e mover para cima), disposição mantida depois de recarregar e tela de celular, sem erros no console. No Chrome sem janela, a animação do Recharts às vezes parou no meio; com movimento reduzido, os gráficos apareceram completos. Também passaram a checagem de tipos, os testes (14 + 6), as 928 mensagens e o OpenAPI. Depois disso, Receitas x despesas passou a mostrar os meses previstos. Com o mouse em dezembro, apareceu "dezembro de 2026 · previsto" com a receita pendente; novembro mostrou a despesa pendente em barra clara. Os meses passados não mudaram. As mensagens passaram a ser 929. Depois, entrou "Próximos" (3, 6 ou 12 meses) com recorrências simuladas. Teste com salário de R$ 5.500 e aluguel de R$ 3.200 mensais a partir de 2026-11-05: novembro a janeiro vieram dos pendentes gravados, e fevereiro a outubro de 2027 vieram simulados, sem contar em dobro. O previsto subiu R$ 2.300 por mês, até R$ 37.450 em outubro de 2027. Com o mouse em junho de 2027 nas barras, apareceu "previsto" com R$ 5.500 e R$ 3.200. A função de simulação tem teste próprio (horizonte, fim, cartão no vencimento, conta e cartão arquivados, recorrência diária antiga). Para as capturas, o contador local de cadastros por IP (`rate_limits`) foi zerado no banco do Docker. Tipos, testes (14 + 7), 930 mensagens e OpenAPI passaram.

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

## finfy — Resultado acumulado (2026-10-26)

Teste SQL isolado em SQLite em memória, sem dados reais: saldo inicial, histórico e mês vazio, meses passados/futuros, pendências/cancelamentos/exclusões, ajustes negativos, reembolso, transferências e filtro de conta, isolamento de wallet, contas arquivadas, pagamento antecipado de cartão e reabertura. Teste de competência de cartão continua passando. `pnpm.cmd test`, `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram.

## 2026-10-26 — finfy: pendências no Resultado acumulado

Teste SQL isolado em memória: entradas e saídas pendentes, transferência entre contas e filtro de uma conta, ajuste negativo, reembolso, meses passados/futuros, exclusões/cancelamentos, isolamento de wallet e contas arquivadas. Compra pendente entra no vencimento; pagamento antecipado em outra conta substitui a projeção; reabertura restaura a pendência. Sem banco externo ou dados reais.

Validação desta alteração: `pnpm.cmd typecheck`, `pnpm.cmd test` (18 testes), `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram. Publicação autorizada após a validação.

## 2026-10-26 — finfy: regressão PostgreSQL no extrato

Logs de produção consultados apenas para diagnóstico: `column reference id is ambiguous`, SQLSTATE `42702`. A consulta completa reproduziu a falha em PGlite antes da correção, com todas as sete migrações reais aplicadas sem alterações. A versão corrigida executa os mesmos builders usados pela API: lista mensal, totais, carteira vazia, saldo inicial e anterior, filtro de conta, categoria/tag/busca sem resultados, mês futuro vazio, cartão no vencimento, quitação antecipada por outra conta e reabertura. Validação do resumo pelo schema compartilhado. Sem banco externo ou dados reais; não foi feito teste autenticado no site de produção. Publicação autorizada após a validação.

Validação final: 19 testes passaram; `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram.

## 2026-10-27 — finfy: totais mensais do extrato com pendências

Receitas e Despesas agora somam os componentes pendentes nos valores principais; o aviso mantém a parte pendente abaixo. Compras de cartão já estão nas despesas da API e não são somadas novamente. Alteração de apresentação, sem mudança de contrato. Os 19 testes e os quatro checks obrigatórios passaram. Sem teste autenticado em produção, sem dados reais e sem publicação nesta etapa.
## 2026-10-27 — cópia local autorizada do banco

Backup lógico de produção solicitado pelo proprietário, executado em modo somente leitura com pg_dump 18 e restaurado em banco separado no loopback (porta 5434). Banco local anterior preservado. Arquivos de backup e configuração anterior fora do repositório; nenhum dado pessoal ou segredo registrado na wiki. `/api/health`: banco `ok`; página pública local `/en`: HTTP 200. Servidor restrito a `127.0.0.1`. Sem validação do login importado, pois a chave externa de senha não foi copiada.
## 2026-10-27 — recarga contínua do localhost

Confirmado ciclo de recompilações e recargas com Turbopack. Servidor reiniciado com Webpack; imports de mensagens tornados explícitos para compatibilidade. Página `/en` respondeu HTTP 200 e logs ficaram sem a repetição contínua durante observação. Os 19 testes e checks de tipos, mensagens e OpenAPI passaram. Sem publicação.

## 2026-10-27 — acesso à cópia local

Com autorização explícita do proprietário, senha exclusiva aplicada à única conta da cópia local, com o pepper local e sem registrar senha, hash, e-mail ou identificador. Bloqueio local por tentativas limpo. Endpoint local de login validado: HTTP 200, `next: app`. Produção não alterada; chave externa de produção não copiada.

## 2026-10-27 — skeletons de carregamento

Primeira aplicação na Home, Extrato e lista de Contas. Revisão de estados: skeleton somente durante carregamento, dados preservados no refresh de um mesmo recurso, mensagens vazias após a resposta, resumo sem valores fictícios. Shapes decorativos ocultos para leitores de tela, indicação traduzida de carregamento e animação desativada com movimento reduzido. Sem alteração de contrato ou cálculo financeiro.
Validação: 19 testes, `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram. Sem publicação e sem novo acesso ao banco de produção.

## 2026-10-27 — extrato com carregamento independente

Tela real montada com React e Happy DOM, transportes controlados e dados sintéticos: resumo antes da lista; lista antes do resumo; erro de cada bloco enquanto o outro permanece pendente e depois conclui; retry isolado; troca de mês recarregando ambos. Totais visíveis incluem pendências. Consultas financeiras e conversor compartilhado verificados em PostgreSQL descartável com todas as migrações. Sem acesso novo a dados reais ou produção.
Validação final: 24 testes (incluindo os quatro cenários de ordem/falha da tela), `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram. Alteração somente local na branch existente; sem commit, push ou deploy.

## 2026-10-27 — carregamento progressivo nas páginas

Testes React com transportes e DOM isolados: Home mostra resumo antes de lançamentos e vice-versa; Contas começa a buscar e mostrar cartões com contas ainda pendentes; Planejamento mostra valores sem esperar os metadados das categorias; Regras apresenta erro recuperável; fatura mostra resumo ou compras em qualquer ordem. Mantidos testes de falha/retry isolados e troca de mês do extrato. Revisão de skeletons/erros em listas arquivadas, metas/histórico, tags, membros, convites, patrimônio e notificações. Sem dados reais usados nos testes, sem acesso a produção e sem publicação.
Validação final desta extensão: 31 testes passaram, assim como `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi`. Tudo mantido na branch local existente, sem commit, push, deploy ou nova versão publicada.

## 2026-10-27 — diagnóstico dos dados em Contas

Inspeção de código e consulta agregada somente leitura na cópia localhost: compras em faturas abertas incluem ocorrências futuras de recorrência, lançamentos futuros e parcelas. Confirmado que o patrimônio aplica contas + bens - dívidas - todas essas compras; limite usado também inclui projeções. Sem nomes, IDs ou valores privados registrados; sem conexão a produção e sem alteração de registros. Decisão sobre separar dívida realizada e previsão encaminhada ao usuário antes de mudar a regra financeira.
## 2026-10-27 — dívida realizada dos cartões

Após confirmação da regra pelo usuário, teste PostgreSQL com todas as migrações e dados sintéticos: compras até hoje; recorrências e avulsos futuros; parcelas de compra já realizada; compra parcelada ainda futura; origem quitada, cancelada ou arquivada; faturas pagas/arquivadas; avanço da data; isolamento por wallet/cartão; quitação e reabertura. Previsões continuam no resumo mensal. Consulta compartilhada também conferida em modo somente leitura na cópia localhost autorizada, exibindo apenas total agregado e sem registrar dados privados nesta wiki.

Validação final: 32 testes, `pnpm.cmd typecheck`, `pnpm.cmd check:messages` e `pnpm.cmd check:openapi` passaram. Notas de versão, modelo e decisão 0022 atualizados. Sem migração, alteração de registros financeiros, acesso a produção, commit ou publicação.
## 2026-10-27 — rótulos de dívida e ciclo do cartão

Revisados pt-BR e en: dívida total dos cartões, explicação das parcelas ainda a vencer e ciclo de compras em andamento com previsões. Sem mudança de cálculo ou dados.

## 2026-10-27 — próximas faturas e organização das telas

Testes sintéticos da próxima fatura realizada, vencidas, previsões, faturas pagas e vencimento hoje. React verifica links do ciclo e patrimônio fora do resumo principal. Interface de Contas conferida no localhost sem alterar dados. Revisão dos grupos de Configurações e escopo dos resumos: Home e Extrato incluem pendências; saldo das contas continua confirmado. Nenhum dado privado registrado.

Validação final: 34 testes, typecheck, check:messages e check:openapi aprovados. Configurações e cabeçalho do Extrato conferidos no navegador local. Revisão React: hooks estáveis, recursos independentes, seções nomeadas e grade responsiva. Wiki atualizada nas decisões 0016, 0022, 0023 e 0024, índices, codebase, data-model e histórico. Notas não publicadas atualizadas; sem commit ou publicação.

## 2026-10-27 — reconciliação com GitHub

Fetch confirmou três commits remotos ausentes na base local: Início personalizável, gráficos com projeções e correção de exclusão. Base atualizada por fast-forward na mesma branch; ajustes locais reaplicados e conflitos da Home/lockfile resolvidos preservando funcionalidades. Backup dos ajustes anteriores mantido em stash. Tabela home_layouts criada pela migração existente apenas na cópia localhost isolada. Testes React agora verificam presença dos dois gráficos enquanto resumo/lista carregam independentemente. Decisão local de releases renumerada para 0025 para preservar a 0019 de produção.

Validação da integração: 36 testes, typecheck, check:messages e check:openapi aprovados. Navegador localhost confirmou os dois gráficos com dados e projeções carregados, além de Personalizar. Sem acesso novo a produção ou publicação; branch existente mantida.

## 2026-10-27 — acesso direto ao patrimônio

Usuário aprovou Patrimônio após Contas e cartões no menu. Mantida a rota existente; seleção de Contas exclui a subpágina Patrimônio para evitar dois destinos ativos. Barra móvel adaptada para seis colunas. Decisões 0023/0024 e codebase atualizados. Sem mudança financeira.

Nome final Bens e dívidas conferido no menu e título do localhost; indicador mantém Patrimônio líquido. Apenas o destino correto fica selecionado. Após reiniciar o servidor e compartilhar o pool entre hot reloads, página carregou normalmente. 36 testes, typecheck, mensagens e OpenAPI aprovados. Sem publicação.

## 2026-10-27 — período personalizado do Extrato

Teste React: intervalo entre meses enviado ao resumo e à lista; dia único; datas invertidas não disparam consultas; retorno ao mês completo. Navegador localhost confirmou intervalo entre meses, campos aplicados e resultado acumulado com data final explícita, sem alterar registros. 37 testes, typecheck, traduções e OpenAPI aprovados. Decisão 0026, índices, codebase e notas atualizados. Somente local, sem publicação.

## 2026-10-27 — calendário e animação do período

Calendar/DatePicker reutilizáveis em packages/ui, com popover macOS, tradução, foco e navegação por teclado. Teste React confirma dia bissexto e retorno de foco ao selecionar. No navegador, seta e Enter selecionaram o dia seguinte e fecharam o popover. Formulário anima abertura e fechamento, respeitando movimento reduzido. Tamanho reduzido após avaliação do usuário. 38 testes totais (14 shared e 24 web), tipos, mensagens e OpenAPI aprovados. Happy DOM usa fallback JS de Motion porque sua simulação WAAPI rejeita promessas ao cancelar animações; aparência conferida no navegador. Decisão 0026, codebase e notas atualizados. Sem publicação.

## 2026-10-27 — minimizar janela do app

Teste React confirma janela inerte enquanto minimizada, foco no restaurar, retorno de foco e preservação do mesmo campo e valor ao restaurar. Navegador localhost confirma botão laranja, controle inferior e restauração na mesma rota. Área principal recorta o deslocamento para evitar rolagem da página durante a animação. 39 testes totais, tipos, mensagens e OpenAPI aprovados. Decisão 0012, codebase e notas atualizados. Somente local, sem publicação.

## 2026-10-27 — Home pública ao minimizar

Teste React estendido: fundo público só aparece minimizado, link Abrir app restaura sem remontar conteúdo. Navegador confirmou a Home pública visível com controle inferior e retorno ao app ao clicar Abrir o finfy. Links internos com fragmentos permanecem na Home. 39 testes e verificações de tipos, mensagens e OpenAPI aprovados. Decisão 0012, codebase e notas atualizados. Sem publicação.

### Home permanentemente ao fundo

Home permanece montada atrás da janela, inerte e aria-hidden enquanto aberta. Blur e escurecimento desaparecem na minimização. Teste de restauração e preservação de conteúdo passou; tipos passaram. Conferência visual no localhost confirmou o cabeçalho da Home desfocado atrás da janela e a Home completa ao minimizar. Sem publicação.

## 2026-10-27 — minimização exclusiva da web

Teste do shell compartilhado sem allowMinimize confirma ausência de fundo público, ação de minimizar e controle de restauração. Teste com opt-in preserva minimização e restauração. Somente AppHost web habilita a opção. 40 testes, typecheck, mensagens e OpenAPI aprovados. Decisão 0012, codebase e notas atualizados, sem publicação.

## 2026-10-27 — botão verde maximiza na web

Teste React verifica maximizar/restaurar, ocultação e retorno da Home, preservação do mesmo campo/valor e foco no botão verde mesmo com mudança do rótulo. Navegador localhost confirmou janela ocupando o viewport sem Home ao fundo e controle de restaurar tamanho. 40 testes, typecheck, traduções e OpenAPI aprovados. Decisão 0012, codebase e notas atualizados. Sem publicação.

## 2026-10-27 — ícone e transição da maximização

Botão verde mostra ícone de expandir ou restaurar conforme o estado. Navegador localhost confirmou alteração do controle ao maximizar; posição e tamanho usam Motion layout, sem transição CSS concorrente. Movimento reduzido desabilita interpolação geométrica. 40 testes, tipos, mensagens e OpenAPI aprovados. Decisão 0012, codebase e notas atualizados. Sem publicação.

## 2026-10-27 — glifo macOS do botão verde

Substituídas setas genéricas por dois triângulos diagonais preenchidos, invertidos no estado restaurar. Mudança visual isolada; typecheck do pacote UI aprovado e aparência conferida no localhost. Codebase e notas atualizados, sem publicação.

## 2026-10-27 — validação para integração na main

Usuário autorizou commit, push e merge na main. Base remota atualizada antes da integração, preservando os três commits existentes da Home. Revisão final: 40 testes, typecheck, check:messages, check:openapi e build de produção aprovados. Código, testes, decisões, índices, modelo, codebase, problemas e notas preparados; arquivos locais de ferramentas e configuração privada excluídos do commit. Sem migração nova neste conjunto.

## 2026-11-05 — instalação em novo Windows

Clone da main e instalação com pnpm 11.25.0 e lockfile congelado concluídos. Configuração local ignorada pelo Git, com pepper aleatório. Typecheck, mensagens (968 chaves por idioma) e OpenAPI aprovados fora do sandbox. Testes: 14 shared aprovados; web com 24 aprovados e uma asserção de subteste falhando, também contabilizada no teste pai (ver problemas encontrados). Sem alteração no código da aplicação.

Servidor Webpack iniciado: `/pt-br` respondeu HTTP 200. `/api/health` respondeu HTTP 503, `database: unreachable`: PostgreSQL ainda não disponível. Docker Desktop baixado; instalador aguardando confirmação UAC do usuário. WSL não instalado. Migrações locais ainda não executadas. Nenhum banco remoto acessado.

## 2026-11-05 — instalação do Docker Desktop

Docker Desktop 4.98.0 instalado com sucesso via winget, com autorização administrativa. CLI confirmou Docker 29.9.2. Requisitos opcionais VirtualMachinePlatform e Microsoft-Windows-Subsystem-Linux habilitados pelo instalador. WSL ainda ausente na verificação após a instalação; instalação do pacote Microsoft.WSL solicitada em processo elevado, aguardando confirmação UAC. Mecanismo e banco local ainda não validados.

## 2026-11-05 — requisito para iniciar PostgreSQL

Instalação do Microsoft.WSL 2.7.14 concluída com sucesso. O WSL informa que WSL2 ainda não pode iniciar. Virtualização no firmware confirmada como habilitada. Registro do instalador do Docker confirma que ativar VirtualMachinePlatform exige reiniciar o computador; Windows tem RebootPending. Banco e migrações locais aguardam reinicialização. Nenhum dado de produção copiado.

## 2026-11-05 — banco local funcionando após reinicialização

Após reiniciar o Windows, Docker Engine 29.9.2 respondeu. PostgreSQL 17 iniciado com Docker Compose, volume local persistente e porta localhost:5432. Oito migrações aplicadas com sucesso por `pnpm.cmd db:migrate`, com DATABASE_URL explicitamente local. `pg_isready` confirmou conexões; consulta confirmou oito registros de migração e zero usuários. Servidor Webpack iniciado em localhost:3000; `/api/health` respondeu `status: ok`, `database: ok`. Banco novo, sem cópia ou acesso a produção. Pendências anteriores de WSL, reinicialização e migrações resolvidas.

## 2026-11-06 — CASL e primeira revisão de segurança

CASL 7.1.1 integrado ao módulo de papéis, preservando a API e as permissões. Dezesseis testes shared aprovados, incluindo todas as combinações de papel/ação e isolamento das abilities retornadas.

Reproduzidos em PGlite migrado os vazamentos por replay de operações de membros/faturas e de metadados de wallet após remoção. Não houve escrita indevida nesses replays; consultas de extrato sem associação ativa foram recusadas nos cenários exercitados. Correções locais e teste de regressão aprovados. Teste de concorrência usa rejeição de senha sincronizada, com comandos e consultas reais: antes dez falhas resultavam em contador um; após o ajuste, dez e bloqueio ativo. O cenário de substituição de convite por ADMIN foi testado com gravador de auditoria substituído, e classificado pelo usuário como comportamento permitido.

Verificação final: typecheck, check:messages e check:openapi aprovados. Shared: 16 aprovados. Web: 25 aprovados; a asserção preexistente do período do extrato continua falhando, também contabilizada no teste pai (2 falhas no relatório). pnpm audit --prod não retornou avisos publicados. Sem acesso a produção, publicação ou mudança de esquema. Ver [relatório](../finfy/security-review.md) e [decisão CASL](../decisoes/0027-casl-na-autorizacao.md).

## 2026-11-06 — segunda rodada de segurança

Três reproduções controladas aprovadas em PGlite migrado: sessão criada por login antigo após troca de senha/revogação; rehash de login antigo substituindo credencial nova; dez verificações OTP concorrentes com só uma tentativa disponível, levando contador de quatro a quatorze. Comandos, criação/revogação/consulta de sessão e SQL reais; verificação/hash de senha, cookies, cache React e consulta de senhas vazadas substituídos para controlar agendamento. OTP com leituras sincronizadas por proxy de consultas e HMAC substituído. Scripts temporários removidos; resultados e método registrados no relatório. Sem mudança no código de produto nesta rodada, sem correção desses novos achados e sem contato com produção.

## 2026-11-06 — correções de concorrência de autenticação

Sete regressões novas aprovadas em PGlite migrado: login antigo com e sem rehash recusado após troca de senha; login concluído antes da troca revogado, preservando a sessão do próprio navegador; duas trocas concorrentes não sobrescrevem credencial nova; orçamento/uso único/expiração OTP; rollback conjunto de senha/revogação/auditoria; falha no commit de login não publica cookie nem deixa sessão. Hashing/verificação de senha, consulta de vazamentos, cookies e cache React substituídos para agendamento controlado; queries e comandos reais.

Verificação completa: 16 shared aprovados; web com 32 aprovados e as duas falhas de relatório da asserção preexistente do período do extrato (subteste e pai). Typecheck, mensagens e OpenAPI aprovados. Tentativa complementar em PostgreSQL externo não executou os cenários: Docker Engine indisponível e conexão local recusada, mesmo após solicitar início do Desktop. Isso não é teste aprovado nem novo defeito da aplicação. Não houve conexão com banco real de produção. Sem migração, publicação ou push. Patch local preparado para revisão.

## 2026-11-06 — validação para nova versão

Docker disponível após abertura pelo usuário. Os sete cenários de concorrência/rollback de autenticação passaram em PostgreSQL 17 externo local, usando bancos descartáveis separados, removidos ao final. Credenciais, consultas, bloqueios e transações reais; crypto de senha, verificação de vazamentos e contexto de cookies controlados como nos testes PGlite. Corrigida a asserção do extrato que dependia de o mês atual não ser novembro, sem alterar produto. Suíte completa: 16 shared e 34 web aprovados; typecheck, mensagens e OpenAPI aprovados. Build/deploy em confirmação. Nenhum banco de produção acessado.

### Resultado final da validação local

Build de produção aprovado. Total de 50 testes reportados aprovados (16 shared e 34 web); sete cenários também aprovados em PostgreSQL 17 externo local. Acesso à equipe Vercel confirmado após autorização do usuário. Revisão automática bloqueou push para main por exigir autorização específica de publicação em produção. Commit local preparado; nenhum push/deploy/tag de produção nesta etapa.

## 2026-11-06 — publicação autorizada da nova versão

Usuário autorizou explicitamente push para main, publicação em produção e criação da nova versão após confirmar o deploy. Commit de segurança enviado; Vercel confirmou deploy de produção READY com SHA correspondente. Notas consolidadas em v0.3.0 por incluir funcionalidades acumuladas desde a tag v0.2.3. Commit final de notas segue para confirmação do deploy antes de marcar a tag. Nenhuma conexão direta ao banco de produção, migração ou alteração de credenciais reais.

## 2026-11-06 — hotfix de edição de compras no cartão

Teste isolado em PGlite com migrações reais e dados sintéticos: edição pela segunda parcela, redistribuição de centavos, meses curtos, preservação de IDs e faturas em alteração só de valor, versões desatualizadas, total insuficiente, repetição idempotente, rejeição atômica de fatura paga e edição textual permitida. Nenhum dado de produção alterado. `pnpm typecheck`, `pnpm test` (16 testes compartilhados e 35 web), `pnpm check:messages` e `pnpm check:openapi` passaram. Validação visual ainda não realizada.

## 2026-11-06 — publicação do hotfix v0.3.1

Push autorizado para main. Vercel confirmou READY em produção para o commit `0b4d900`, com a edição financeira de compras no cartão. Notas consolidadas em v0.3.1; o commit final de documentação será verificado antes da tag anotada. Nenhuma migração ou alteração de dados de produção.
