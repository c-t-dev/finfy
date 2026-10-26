# 0012 — Motion para animações React

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

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
