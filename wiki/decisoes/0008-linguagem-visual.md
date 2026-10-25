# 0008 — Linguagem visual: a mesma do image-resizer

> Status: Aceita · Decidido em 2026-10-25 · Última atualização: 2026-10-25

## Contexto

A pessoa quer a interface do finfy "como foi feita no projeto editor de imagens", o **image-resizer** (`D:\projetos\image-resizer`), com **o mesmo shadcn/ui e o mesmo Tailwind**. Lá a interface imita uma janela do macOS e segue os princípios de design da Apple.

Isso levou a trocar Flutter por React em todos os clientes ([0009](0009-react-tauri-capacitor.md)). Com isso, a interface pode ser copiada de verdade, não só imitada.

Referências no image-resizer:

| O quê | Onde |
| --- | --- |
| Guia de interface | `wiki/pt/06-interface-design.md` (em inglês: `wiki/en/06-ui-design.md`) |
| Tokens, temas e regras de acessibilidade | `packages/ui/src/styles/globals.css` |
| Componentes | `packages/ui/src/components/*` |
| Regras para agentes | `CLAUDE.md`, seção "UI conventions" |

## Decisão

### 1. Mesma stack de interface

- **Tailwind v4** com `@theme inline` e `tw-animate-css`.
- **shadcn/ui** no estilo *new-york*, com os primitivos do pacote `radix-ui`, reestilizado para macOS.
- Pacote interno **`packages/ui`** (`@packages/ui`), como no image-resizer. Ele contém os componentes, os tokens e o `globals.css`. Ele é a fonte única de estilo para a web, o Tauri e o Capacitor.
- Ponto de partida: **copiar** `packages/ui` do image-resizer (componentes, `globals.css`, `cn`, `use-mounted`) e ajustar a partir daí.

### 2. Componentes

Os do image-resizer, já reestilizados: `button`, `segmented-control`, `tabs`, `select`, `dropdown-menu`, `dialog`, `tooltip`, `slider`, `checkbox`, `input`, `label`, `progress`, `card`, `spinner` (12 raios), `mac-window` (`MacWindow`, `MacTitlebar`, `TrafficLights`) e `sonner` (toasts).

O finfy vai precisar de outros, que nascem dentro de `packages/ui` seguindo a receita da seção 5. Exemplos: tabela, calendário e seletor de data, combobox, campo de valor em moeda, gráficos, folha lateral (*sheet*) e barra de navegação inferior para o celular.

### 3. Tokens e temas

Os mesmos nomes e valores do `globals.css` do image-resizer, em `:root` (claro) e `.dark` (escuro):

- `background`, `foreground`, `card`, `popover`;
- `primary` (azul do sistema `#007AFF` / `#0A84FF`);
- `secondary`, `muted`, `accent`;
- `destructive`, `success`;
- `border`, `input`, `ring`;
- `window`, `titlebar`, `sidebar` e `--wallpaper`.

O raio base é `0.625rem` (10 px).

Regras:

- Nenhuma cor fixa nos componentes; só tokens.
- O tema é o do sistema por padrão (`next-themes` ou equivalente, com `attribute="class"`). A troca de tema faz uma transição suave com a View Transitions API.
- Mantêm-se as regras de `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast: more` do `globals.css`.
- Cores de finanças: gasto usa `destructive` e ganho usa `success`. O sinal ou o ícone sempre acompanha o valor, para não depender só da cor.

### 4. Princípios Apple

Os mesmos do image-resizer:

| Princípio | Como |
| --- | --- |
| Resposta imediata | `active:scale-[0.97]` em ~100 ms nos controles |
| Menos latência artificial | Loader só aparece depois de 250 ms de espera |
| Materiais | Barra de título, barra lateral e menus translúcidos (`backdrop-blur` + `saturate`) |
| Materializar | Superfícies flutuantes com `animate-materialize-in/out` (desfoque + escala) |
| Consistência espacial | Menus nascem do botão que os abriu |
| Tipografia | Fonte do sistema (SF Pro), Inter como alternativa; texto de 12–13 px; tracking por tamanho |

### 5. Criar um componente novo

Mesma receita do image-resizer:

1. Gerar dentro de `packages/ui` com `pnpm dlx shadcn@latest add <componente>`.
2. Ajustar:
   - texto de 12–13 px e cantos `rounded-md` ou `rounded-lg`;
   - superfícies flutuantes com `bg-popover/90 backdrop-blur-2xl` e `animate-materialize-in/out`;
   - controles clicáveis com `active:scale-[0.97]` e `transition-[…,scale] duration-100`;
   - `data-slot="nome"` na raiz, usado pelas regras de acessibilidade do CSS.
3. Usar no app por `@packages/ui/components/<nome>`.

### 6. Estrutura da tela

- **Desktop e web larga (≥ 768 px):** janela macOS sobre o "wallpaper". À esquerda fica a barra lateral translúcida, com o seletor de wallet no topo e a navegação (Início, Extrato, Contas, Objetivos etc.). O conteúdo faz scroll por baixo da barra de título translúcida.
- **Celular:** sem moldura de janela. A navegação vai para uma barra inferior, com os mesmos tokens e materiais. Respeita a área segura do sistema (`env(safe-area-inset-*)`).

## Diferenças em relação ao image-resizer

| Tema | image-resizer | finfy |
| --- | --- | --- |
| Idioma da interface | pt-PT | pt-BR, pt-PT e en ([0009](0009-react-tauri-capacitor.md)) |
| Plataformas | Só web | Web, Tauri (Windows, macOS) e Capacitor (Android, iOS) |
| Telas | Uma ferramenta por vez | App completo, com navegação lateral ou inferior |
| Celular | A janela ocupa a tela | Sem moldura, navegação inferior |

## Perguntas em aberto

1. **Moldura da janela no Tauri.** No macOS, usar a barra de título nativa transparente com os semáforos reais? No Windows, imitar os semáforos do macOS ou usar os botões nativos do Windows com o mesmo material?
2. **Celular:** manter o visual macOS no Android ou adaptar para algo mais neutro?
3. **Desfoque no WebView:** `backdrop-filter` pode pesar em aparelhos Android mais fracos. Medir e, se precisar, usar superfícies sólidas (como na regra de transparência reduzida).
4. **Pacote compartilhado entre projetos:** copiar `packages/ui` para o finfy (cada projeto evolui sozinho) ou publicar um pacote comum ao image-resizer e ao finfy?
