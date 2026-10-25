# AGENTS.md

Instruções para qualquer agente de IA que trabalhe neste repositório: Claude Code, Codex, IAs locais ou outros. Este arquivo é a fonte única; `CLAUDE.md` apenas aponta para cá.

## O que é este projeto

**finfy** é um projeto de finanças pessoais. O repositório contém:

- a documentação de referência do app **Minhas Economias**, obtida por engenharia reversa do portal web, em [`wiki/`](wiki/README.md);
- as decisões do próprio finfy em [`wiki/decisoes/`](wiki/decisoes/README.md): várias moedas (EUR e BRL), várias wallets por usuário com compartilhamento, papéis e transferência de posse, convites por e-mail, segurança da conta, offline-first com sincronização e auditoria;
- a análise do **Wallefy** (projeto `my-fin`), usado como base para wallets, convites e segurança, em [`wiki/referencias/wallefy.md`](wiki/referencias/wallefy.md).

Já decidido sobre a stack:

- Clientes em **React + TypeScript, com shadcn/ui e Tailwind v4**: web só online; **Tauri** para Windows e macOS; **Capacitor** para Android e iOS. Os apps nativos funcionam offline ([0009](wiki/decisoes/0009-react-tauri-capacitor.md)). A [0007](wiki/decisoes/0007-flutter-nos-clientes.md) (Flutter) foi substituída: não use Flutter.
- Interface igual à do projeto **image-resizer** (`D:\projetos\image-resizer`): mesmo `packages/ui`, tokens, estilo macOS e princípios Apple ([0008](wiki/decisoes/0008-linguagem-visual.md)).
- Sincronização com **PowerSync + Postgres**, com toda escrita passando pela API do finfy ([0005](wiki/decisoes/0005-offline-first-e-sincronizacao.md)).
- O backend (linguagem e framework da API) ainda não foi escolhido.

Decisões com status "Proposta" têm perguntas em aberto; não as trate como fechadas. O que ainda não foi decidido não deve ser inventado: pergunte.

## Onde fica cada modelo de dados

- **finfy:** [`wiki/finfy/data-model.md`](wiki/finfy/data-model.md), em inglês. É o modelo a seguir no código. A parte financeira ainda é rascunho.
- **Minhas Economias (referência):** [`wiki/api/modelo-de-dados.md`](wiki/api/modelo-de-dados.md). Não use como modelo do finfy.
- Ao mudar uma decisão que afete tabelas, atualize o `data-model.md` no mesmo trabalho.

## Antes de começar qualquer tarefa

1. Leia [`wiki/README.md`](wiki/README.md) (índice) e a página da funcionalidade envolvida.
2. Para dúvidas de API, use [`wiki/api/endpoints.md`](wiki/api/endpoints.md), [`wiki/api/payloads.md`](wiki/api/payloads.md) e [`wiki/api/modelo-de-dados.md`](wiki/api/modelo-de-dados.md).
3. Veja [`wiki/problemas-encontrados.md`](wiki/problemas-encontrados.md) para não repetir os erros do app de referência.
4. Veja [`wiki/pendencias.md`](wiki/pendencias.md) para saber o que ainda não é conhecido.

## Manter o contexto atualizado (obrigatório)

Este repositório é usado por agentes diferentes, que não compartilham memória. O único contexto comum é o que está escrito aqui. Por isso:

- Toda descoberta, decisão ou mudança de comportamento entra na wiki **no mesmo trabalho** que a gerou, seguindo [`wiki/MANUTENCAO.md`](wiki/MANUTENCAO.md).
- Decisões de produto ou de arquitetura do finfy entram em [`wiki/decisoes/`](wiki/decisoes/README.md), um arquivo numerado por decisão, com status, e no índice. Quando uma pergunta em aberto for respondida, atualize a decisão e o status.
- Atualize a data "Última atualização" das páginas que mudar e do índice.
- Se algo na wiki estiver errado, corrija; não deixe duas versões.
- Ao terminar, o resumo para a pessoa deve dizer quais páginas da wiki mudaram.

## Convenções

- Idioma: português do Brasil, frases curtas. Exceção: a documentação técnica do finfy em `wiki/finfy/` (modelo de dados e o que vier a seguir) é em inglês.
- Markdown simples, tabelas para listas comparáveis, nomes de API em `código` exatamente como aparecem.
- Commits pequenos e descritivos, em português, no formato `tipo: descrição` (ex.: `docs: documenta ciclo da fatura`).

## Segurança e dados

- Nunca grave no repositório tokens, cookies, senhas, CPF, nomes reais, e-mails ou UUIDs de contas reais. Use marcadores (`{uuidAccount}`).
- Testes no app real só na conta de teste, com itens prefixados `[TESTE]`, registrados em [`wiki/testes/dados-de-teste.md`](wiki/testes/dados-de-teste.md).
- No app real, **botões de apagar agem sem confirmação**. Não apague nada sem pedido explícito.
- Não conecte bancos reais, não migre dados da versão antiga e não altere senha nem conta.
