# 0008 — Linguagem visual no estilo macOS

> Status: Proposta · Escrita em 2026-10-25

## Contexto

A pessoa quer a interface do finfy "como foi feita no projeto editor de imagens", o **image-resizer** (`D:\projetos\image-resizer`). Lá a interface imita uma janela do macOS e segue os princípios de design da Apple. A referência completa está em `image-resizer/wiki/pt/06-interface-design.md` e os tokens em `image-resizer/packages/ui/src/styles/globals.css`.

O image-resizer é React (Next.js, Tailwind, shadcn). O finfy é Flutter ([0007](0007-flutter-nos-clientes.md)). Por isso a decisão copia a **linguagem visual e as regras**, não o código.

## O que o image-resizer faz

| Aspecto | Como é lá |
| --- | --- |
| Visual | Janela macOS: semáforos decorativos, barra de título translúcida, barra lateral com "vibrancy", controles segmentados, azul do sistema |
| Fundo | "Wallpaper" com gradientes suaves (estilo macOS Sonoma), diferente no claro e no escuro |
| Componentes | Pacote próprio `@packages/ui`: shadcn reestilizado (botão, controle segmentado, tabs, select, menu, diálogo, tooltip, slider, checkbox, input, progresso, spinner de 12 raios, janela, toasts) |
| Cores | Só por tokens (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `border`, `input`, `ring`, `window`, `titlebar`, `sidebar`), em claro e escuro. Nada de cor fixa no componente |
| Tema | Sistema por padrão; troca com transição suave (sem salto de brilho) |
| Texto | Fonte do sistema (SF Pro), Inter como alternativa; texto de 12–13 px; tracking por tamanho (títulos `-0.022em`, texto pequeno `+0.01em`) |
| Movimento | Resposta imediata ao toque (escala 96–97%, ~100 ms); superfícies flutuantes "materializam" (desfoque + escala, 220 ms entrada, 140 ms saída); menus nascem do botão que os abriu; loaders com no mínimo 250 ms, só para não piscar |
| Acessibilidade | Movimento reduzido → só fades; transparência reduzida → materiais sólidos; contraste aumentado → bordas e textos mais fortes; foco visível em todos os controles |

## Decisão

### 1. Um pacote de design próprio: `finfy_ui`

Equivalente ao `@packages/ui`. As telas usam **só** widgets desse pacote. Widget novo nasce dentro dele, já no estilo.

Não usar Material com tema padrão nem o pacote `macos_ui` como base: o `macos_ui` só faz sentido no desktop, e o finfy roda também em Android, iOS e web.

### 2. Tokens copiados do image-resizer

Os mesmos nomes e valores, num `ThemeExtension` (`FinfyColors`) com versão clara e escura. Valores iniciais:

| Token | Claro | Escuro |
| --- | --- | --- |
| `background` | `#F2F2F5` | `#141416` |
| `foreground` | `#1D1D1F` | `#F5F5F7` |
| `card` | `#FFFFFF` | `#2A2A2D` |
| `popover` | `#FFFFFF` | `#2C2C2F` |
| `primary` | `#007AFF` | `#0A84FF` |
| `secondary` | `#E9E9ED` | `#3A3A3D` |
| `muted` | `#F0F0F3` | `#2A2A2D` |
| `mutedForeground` | `#6E6E73` | `#98989F` |
| `accent` | `#ECECF0` | `#3A3A3D` |
| `destructive` | `#FF3B30` | `#FF453A` |
| `success` | `#34C759` | `#30D158` |
| `border` | preto 10% | branco 10% |
| `input` | preto 14% | branco 14% |
| `window` | branco 78% | `#202023` 80% |
| `titlebar` | `#F6F6F8` 72% | `#2C2C2F` 70% |
| `sidebar` | `#F0F0F3` 60% | `#262629` 55% |

Raio base 10 px (`sm` 6, `md` 8, `lg` 10, `xl` 14, `2xl` 18). Também há variantes de **contraste aumentado** e de **transparência reduzida**, com os valores do `globals.css` do image-resizer.

Cores de finanças: gasto usa `destructive` e ganho usa `success`. Para não depender só da cor, o sinal ou o ícone sempre acompanha o valor.

### 3. Equivalências React → Flutter

| image-resizer | finfy (Flutter) |
| --- | --- |
| `backdrop-blur` + `saturate` | `BackdropFilter` com `ImageFilter.blur` sobre a cor translúcida do token |
| `active:scale-[0.97]` | Widget base `Pressable` que escala para 0.97 em ~100 ms no `onTapDown` |
| `animate-materialize-in/out` | Rota e overlay próprios (menus, diálogos, tooltips): opacidade + escala 0.96 + desfoque, 220 ms / 140 ms, origem no widget que abriu |
| `next-themes` + View Transitions | `ThemeMode.system` por padrão; troca com fade dos tokens (`AnimatedTheme` ou interpolação via `ThemeExtension.lerp`) |
| `prefers-reduced-motion` | `MediaQuery.disableAnimations` → só fades |
| `prefers-contrast: more` | `MediaQuery.highContrast` → tokens de contraste aumentado |
| `prefers-reduced-transparency` | Não existe no Flutter; ver perguntas em aberto |
| Spinner de 12 raios | `FinfySpinner` desenhado com `CustomPainter` |
| `data-slot` | Não precisa; as regras de acessibilidade ficam dentro de cada widget |

### 4. Estrutura da tela

- **Desktop e web larga (≥ 768 px):** barra lateral translúcida à esquerda com a navegação (Início, Extrato, Contas, Objetivos etc.) e o seletor de wallet no topo. O conteúdo faz scroll por baixo de uma barra de título translúcida.
- **Telas estreitas (celular):** sem moldura de janela; a navegação vai para uma barra inferior, mantendo os mesmos materiais e tokens.
- O "wallpaper" com gradientes fica atrás da janela na web e no desktop. No celular, o fundo é `background` liso.

### 5. Regras que valem para todo widget

1. Nenhuma cor fixa: só tokens.
2. Texto de controles com 12–13 px no desktop e na web. No celular o mínimo é o tamanho de sistema, para respeitar a fonte dinâmica.
3. Todo controle clicável tem resposta de pressão e foco visível.
4. Superfícies flutuantes materializam e nascem do gatilho.
5. Loader só depois de 250 ms de espera, para não piscar.
6. `Semantics` em todo botão só com ícone, para leitores de tela (regra 4 da [0007](0007-flutter-nos-clientes.md)).

## Diferenças em relação às referências

| Tema | image-resizer | Minhas Economias | finfy |
| --- | --- | --- | --- |
| Tecnologia | React + shadcn | Flutter com tema próprio | Flutter com pacote `finfy_ui` |
| Idioma da interface | pt-PT | pt-BR | pt-BR, pt-PT e en ([0007](0007-flutter-nos-clientes.md)) |
| Celular | Janela ocupa a tela | App próprio | Sem moldura de janela, navegação inferior |
| Acessibilidade | Preferências do sistema respeitadas | Árvore de acessibilidade vazia na web | Preferências do sistema + `Semantics` |

## Perguntas em aberto

1. **Moldura da janela nos apps de desktop.** No macOS, usar a barra de título nativa transparente com os semáforos reais? No Windows, imitar o macOS (semáforos) ou usar os botões nativos do Windows com o mesmo material?
2. **Transparência reduzida:** o Flutter não expõe essa preferência. Oferecer uma opção nas configurações do app?
3. **Celular:** manter o visual macOS no Android ou adaptar para algo mais neutro?
4. **Fonte:** SF Pro só existe nos aparelhos Apple. Usar Inter em Windows, Android e web (como o image-resizer)?
5. **Desfoque na web:** o `BackdropFilter` pesa no Flutter Web. Medir e, se precisar, usar superfícies sólidas na web.
