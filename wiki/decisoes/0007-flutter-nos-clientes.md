# 0007 — Flutter nos apps e na web

> Status: Aceita · Decidido em 2026-10-25

## Contexto

A sincronização será feita com PowerSync + Postgres ([0005](0005-offline-first-e-sincronizacao.md)). Os apps de Windows, macOS, Android e iOS funcionam offline; a web é só online. Entre os SDKs do PowerSync, o Dart/Flutter é o único que cobre as quatro plataformas nativas com uma base de código só (tabela de suporte na 0005).

## Decisão

**Flutter para todos os clientes:** apps nativos de Windows, macOS, Android e iOS, e a versão web.

| Cliente | Dados | Sincronização |
| --- | --- | --- |
| Windows, macOS, Android, iOS | SQLite local via SDK Dart do PowerSync, criptografado | Descida pelo PowerSync; subida pela fila para `/api/sync/push` |
| Web | Nenhum dado financeiro guardado no navegador | Nenhuma: lê e grava direto na API |

### Regras para a base de código

1. **Uma camada de dados com duas implementações** atrás da mesma interface (repositórios): uma usa o banco local e a fila do PowerSync (nativo), a outra chama a API diretamente (web). Telas e regras de negócio do cliente não sabem qual está em uso.
2. **A web não inicializa o PowerSync** nem o banco local.
3. **Rotas por URL na web** (estratégia de caminho, sem `#`), com links diretos funcionando para qualquer tela. No Minhas Economias, que também é Flutter Web, abrir uma rota direto pela barra de endereço voltava ao Início ([problemas-encontrados.md](../problemas-encontrados.md)).
4. **Acessibilidade na web:** semântica do Flutter ligada e testada com leitor de tela. No Minhas Economias a árvore de acessibilidade estava vazia, o que impede leitores de tela e automação de testes.
5. **Formulários prontos antes de aceitar digitação.** No Minhas Economias, o que era digitado enquanto o formulário carregava se perdia.
6. Segredos e tokens no armazenamento seguro de cada sistema ([0005](0005-offline-first-e-sincronizacao.md#dados-no-aparelho)); na web, sessão em cookie `HttpOnly` ([0004](0004-seguranca-da-conta.md)).
7. Idiomas desde o início: pt-BR, pt-PT e en, com formatação de moeda pelo idioma ([0001](0001-multimoeda.md)).

## Consequências

- Uma única linguagem (Dart) e um único conjunto de telas para cinco plataformas.
- O código de interface do Wallefy (Next.js, React, shadcn/ui) não é reaproveitado; o design e os fluxos sim, como referência.
- Flutter Web desenha em canvas: carregamento inicial maior que um site comum e indexação por buscadores fraca. Isso não importa para o app logado; um site institucional, se houver, pode ser feito à parte.
- O backend (API) é independente desta decisão e ainda não foi escolhido.

## Perguntas em aberto

- [ ] Linguagem e framework do backend (API, regras de permissão, auditoria, `push` da sincronização).
- [ ] Gerenciamento de estado e injeção de dependências no Flutter (ex.: Riverpod, Bloc).
- [ ] Haverá site institucional separado do app web?
