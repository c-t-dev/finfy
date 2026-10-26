# 0013 — Janela de autenticação sobre a Home

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

## Contexto

A pessoa pediu amarelo para minimizar o login, verde para restaurar e Home ao fundo. Esclareceu depois que o acesso direto deve mostrar login sozinho. Isso substitui a composição inicial que sempre renderizava a Home atrás do login.

## Decisão

- Usar Parallel Routes e Intercepting Routes do Next.js: slot `@auth` no layout público e rotas `(.)sign-in` e `(.)sign-up`.
- Na Home, os botões apontam ao login localizado para visitantes; quem tem sessão segue para `/app`.
- Pela Home, o login abre sobre a página retida e a URL muda para o login. Voltar fecha; Avançar reabre.
- Acesso direto e recarregamento do login mostram a página independente, sem Home nem blur. Cadastro segue o mesmo padrão. Alternar entre login e cadastro na página independente mantém esse modo.
- As páginas independentes de login e cadastro têm link "Voltar para a Home" no idioma atual e o mesmo rodapé público da Home. A janela fica centralizada entre o cabeçalho e o rodapé.
- Na sobreposição, amarelo minimiza e o verde da barra inferior restaura. O formulário permanece montado durante minimizar/restaurar. A janela oculta fica `inert`; o foco vai ao verde e volta ao primeiro campo ao restaurar.
- Com a janela aberta, a Home fica `inert`. Blur leve e preto a 20% separam as camadas, com fade na minimização/restauração. Movimento reduzido usa só opacidade.
- Os links de login na Home revelada restauram a janela existente sem navegação. Cliques modificados e para outra aba mantêm a navegação normal.
- Minimizar substitui a URL pela Home do idioma atual via `history.replaceState`, integrado ao Next, mantendo o slot montado. Restaurar recupera a URL original de autenticação, incluindo parâmetros. Não adiciona entradas ao histórico.
- Recarregar minimizado abre só a Home; recarregar restaurado abre o login independente. O estado minimizado não persiste fora da navegação atual.
- Página independente não tem ação de minimizar: não há Home retida abaixo dela. O vermelho continua decorativo. Verde da barra minimizada restaura, sem tela cheia do navegador.
- Defaults vazios e catch-all limpam o slot. `AuthPage` compartilha checagem de sessão, redirecionamento seguro e regras de convite entre as duas versões.
- `packages/app` recebe propriedades genéricas e não importa Next.js. O roteamento e a sincronização da URL ficam em `apps/web`.

Sem mudanças no banco ou na API.
