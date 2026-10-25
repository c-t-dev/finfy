# 0009 — React com shadcn e Tailwind, Tauri no desktop e Capacitor no celular

> Status: Aceita · Decidido em 2026-10-25 · Substitui a [0007](0007-flutter-nos-clientes.md)

## Contexto

A [0007](0007-flutter-nos-clientes.md) escolheu Flutter porque, na tabela do PowerSync usada na época, o SDK Dart/Flutter era o único que cobria Windows, macOS, Android e iOS com uma base de código só.

Depois a pessoa pediu a interface do **image-resizer** ([0008](0008-linguagem-visual.md)), que usa shadcn/ui e Tailwind. Não há Tailwind oficial para Flutter: o Tailwind gera CSS e o Flutter não usa CSS. Existem só pacotes da comunidade que imitam a ideia (Wind, mix) e um port do shadcn (`shadcn_ui`).

Ao conferir de novo a página de plataformas do PowerSync ([docs.powersync.com/resources/supported-platforms](https://docs.powersync.com/resources/supported-platforms), em 2026-10-25), apareceram dois SDKs que não tinham sido pesados:

| SDK | Plataformas |
| --- | --- |
| Capacitor (Capacitor 8+) | iOS 15+ e Android SDK 24+ com SQLite nativo; web com WASQLite; Electron 28+ "a verificar" |
| Tauri | Windows, macOS e Linux; iOS e Android "não testados" |

Com eles, uma única base de código web (React) cobre todas as plataformas.

## Decisão

**Todos os clientes em React, com shadcn/ui e Tailwind, como no image-resizer.**

| Cliente | Casca | Dados | Sincronização |
| --- | --- | --- | --- |
| Web | Navegador | Nenhum dado financeiro guardado no navegador | Nenhuma: lê e grava direto na API |
| Windows, macOS | **Tauri** | SQLite local pelo SDK Tauri do PowerSync | Descida pelo PowerSync; subida pela fila para `/api/sync/push` |
| Android, iOS | **Capacitor** | SQLite nativo pelo SDK Capacitor do PowerSync | Igual ao desktop |

Tauri não é usado no celular porque o PowerSync marca iOS e Android no Tauri como "não testados".

### Regras para a base de código

1. **Monorepo pnpm**, no mesmo formato do image-resizer:
   - `packages/ui`: componentes shadcn com o estilo do finfy, tokens e `globals.css` ([0008](0008-linguagem-visual.md));
   - o app React compartilhado: telas, rotas e regras do cliente;
   - uma pasta por casca: web, Tauri (desktop) e Capacitor (celular).
2. **Uma camada de dados com duas implementações** atrás da mesma interface (repositórios). A versão nativa usa o banco local e a fila do PowerSync; a versão web chama a API diretamente. Telas e regras não sabem qual está em uso.
3. **A web não inicializa o PowerSync** nem o banco local.
4. **Rotas por URL na web**, com links diretos funcionando para qualquer tela. No Minhas Economias, abrir uma rota pela barra de endereço voltava ao Início ([problemas-encontrados.md](../problemas-encontrados.md)).
5. **Acessibilidade:** HTML semântico e os primitivos Radix do shadcn; testar com leitor de tela. No Minhas Economias (Flutter Web) a árvore de acessibilidade estava vazia.
6. **Formulários prontos antes de aceitar digitação.** No Minhas Economias, o que era digitado enquanto o formulário carregava se perdia.
7. Segredos e tokens no armazenamento seguro de cada sistema ([0005](0005-offline-first-e-sincronizacao.md#dados-no-aparelho)); na web, sessão em cookie `HttpOnly` ([0004](0004-seguranca-da-conta.md)).
8. Idiomas desde o início: pt-BR, pt-PT e en, com formatação de moeda pelo idioma ([0001](0001-multimoeda.md)).
9. Tudo em TypeScript; código, comentários e identificadores em inglês.

## Por que não Flutter

| | Flutter | React com Tauri e Capacitor |
| --- | --- | --- |
| Interface do image-resizer | Só por adaptação (`shadcn_ui`, sem Tailwind) | Igual: mesmos componentes, tokens e CSS |
| Web | Desenha num canvas: sem DOM, acessibilidade frágil, links diretos a configurar (os problemas vistos no Minhas Economias) | Web de verdade |
| Experiência da pessoa | Nenhum projeto em Flutter | my-fin, image-resizer e outros já são React/Next.js |
| Sincronização | Um SDK só, o mais maduro | Dois SDKs (Tauri e Capacitor), mais novos |
| Desempenho | Compilado nativo | WebView; suficiente para um app de listas e formulários |

## Consequências

- O código de interface do Wallefy (React, shadcn/ui) e do image-resizer pode ser reaproveitado.
- Dois SDKs do PowerSync para manter, em vez de um.
- O backend (API) continua independente desta decisão e ainda não foi escolhido.

## Perguntas em aberto

- [ ] **Prova de conceito antes do primeiro código de produto:** um app Tauri (Windows e macOS) e um Capacitor (Android e iOS) sincronizando uma tabela pelo PowerSync, com escrita pela API. Se algum SDK falhar, revisar esta decisão.
- [ ] Banco local criptografado ([0005](0005-offline-first-e-sincronizacao.md#dados-no-aparelho)): verificar se os SDKs Tauri e Capacitor do PowerSync suportam SQLCipher ou outra criptografia.
- [ ] Framework do app compartilhado: Tauri e Capacitor precisam de arquivos estáticos (sem servidor). Vite + React Router serve as três cascas; Next.js com exportação estática é a alternativa. Ainda não decidido.
- [ ] Gerenciamento de estado e dados no cliente (ex.: TanStack Query, Zustand).
- [ ] Linguagem e framework do backend.
- [ ] Haverá site institucional separado do app web?
