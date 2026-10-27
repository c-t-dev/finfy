# 0012 — Motion para animações React

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-27

## Contexto

A pessoa aprovou instalar Motion (antes Framer Motion) após verificar a compatibilidade com React, Next.js e Tailwind v4 na documentação oficial.

## Decisão

- Instalar `motion` em `packages/app`, onde ficam as telas compartilhadas. Importar de `motion/react` em componentes cliente, sem dependência de Next.js.
- Manter `tw-animate-css` e as animações CSS existentes. Evitar animar a mesma propriedade no mesmo elemento por CSS e Motion simultaneamente.
- Ao aplicar Motion, respeitar a preferência de movimento reduzido com `MotionConfig reducedMotion="user"` e, quando necessário, `useReducedMotion`.
- A entrada e a troca de telas usam um fade de 200 ms com deslocamento vertical de 6 px no contêiner compartilhado do `AppShell`, no desktop e no celular. Com movimento reduzido (ou preferência ainda desconhecida), apenas fade de 120 ms.
- A animação não remonta a tela, não espera uma saída e não atrasa a navegação. Mudanças de dados na mesma rota não reiniciam a animação.

Não há mudanças no modelo de dados ou na API.

O mesmo componente `ScreenTransition` anima a janela inteira de `AuthWindow`, incluindo moldura e barra de título: login, cadastro e verificação de e-mail, na entrada e quando o título da etapa muda. Digitar no formulário não reinicia a animação.

A entrada da janela de autenticação é mais visível: 450 ms, deslocamento vertical de 24 px, escala de 0,96 a 1 e opacidade de 0 a 1. Com movimento reduzido ou preferência desconhecida, usa apenas fade de 120 ms. As telas do app mantêm a entrada discreta descrita acima.

## Referências

- [Instalação e Next.js](https://motion.dev/docs/react-installation)
- [Tailwind v4](https://motion.dev/docs/react-tailwind)
- [Acessibilidade](https://motion.dev/docs/react-accessibility)

## Minimizar o app (2026-10-27)

Botão laranja da janela logada usa o mesmo efeito do login: escala até 0,15, deslocamento para baixo de 40vh e fade em 350 ms; restaurar inverte o efeito. Movimento reduzido ou desconhecido usa apenas fade de 120 ms. A janela fica montada e inerte enquanto minimizada. Controle inferior restaura a janela, com foco transferido ao restaurar e devolvido ao botão anterior. Sem navegação ou alteração de dados.

Ao minimizar o app, mostrar a Home pública atrás da janela, como no login. O host fornece PublicHome como slot renderizado no servidor; packages/app permanece independente de Next.js. Abrir app na Home restaura a janela atual sem navegar, assim como o controle inferior. Troca de idioma usa o comportamento do app para manter a sessão e rota.

A Home pública permanece montada por trás da janela também quando aberta, com o mesmo desfoque e escurecimento do login. Fica inerte e oculta para leitores de tela enquanto o app está aberto; minimizar revela a Home retirando o efeito.

Restrição aprovada: minimizar para revelar a Home pública é exclusivo da web. AppShell exige allowMinimize explícito, desativado por padrão; somente AppHost web o habilita. Tauri e Capacitor usam os controles nativos do sistema, sem Home pública ao fundo.

Botão verde da web maximiza a janela dentro do navegador, remove margens e oculta a Home pública ao fundo. Novo clique restaura tamanho e fundo anteriores. Não usa fullscreen do navegador. Estado dos formulários e preferência de largura são preservados; minimizar a partir de maximizado revela a Home e restaurar mantém maximizado. Controles nativos continuam a cargo do sistema.

Maximizar e restaurar usam transição de posição/tamanho com Motion layout por 350 ms, desativada com movimento reduzido. Ícone do botão verde indica expandir ou restaurar conforme o estado, mantendo rótulo acessível e foco.
