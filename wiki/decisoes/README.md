# Decisões do finfy

> Última atualização: 2026-10-25

Cada decisão de produto ou arquitetura do finfy fica num arquivo próprio, numerado, para que qualquer agente saiba o que já foi decidido e por quê.

| # | Decisão | Status |
| --- | --- | --- |
| [0001](0001-multimoeda.md) | Várias moedas (EUR e BRL) | Proposta |
| [0002](0002-wallets-e-compartilhamento.md) | Wallets, papéis, compartilhamento e transferência de posse | Proposta |
| [0003](0003-convites-por-email.md) | Convites para wallets por e-mail | Proposta |
| [0004](0004-seguranca-da-conta.md) | Segurança da conta (senha, MFA, sessões) | Proposta |
| [0005](0005-offline-first-e-sincronizacao.md) | Offline-first e sincronização: apps nativos offline, web online, PowerSync + Postgres com escrita pela API | Proposta (plataformas e tecnologia de sincronização já decididas) |
| [0006](0006-auditoria.md) | Auditoria por wallet (imutável, origem, diferença por campo) | Proposta (visibilidade já decidida: todos veem tudo) |
| [0007](0007-flutter-nos-clientes.md) | Flutter nos apps nativos (Windows, macOS, Android, iOS) e na web | Substituída pela [0009](0009-react-tauri-capacitor.md) |
| [0008](0008-linguagem-visual.md) | Linguagem visual: a mesma do image-resizer (shadcn, Tailwind, estilo macOS) | Aceita (moldura da janela e celular em aberto) |
| [0009](0009-react-tauri-capacitor.md) | React com shadcn e Tailwind; Tauri no desktop, Capacitor no celular | Aceita (prova de conceito pendente) |
| [0010](0010-nextjs-na-vercel.md) | Web primeiro, em Next.js na Vercel, com páginas públicas e a API dentro | Aceita (banco, ORM e contrato da API em aberto) |
| [0011](0011-traducoes.md) | Traduções em pt-BR e en (pt-PT depois), mensagens ICU, API devolve códigos | Aceita (padrão: en; biblioteca em aberto) |

## Status

- **Proposta:** escrita, aguardando confirmação das perguntas em aberto.
- **Aceita:** confirmada; o código deve seguir.
- **Substituída:** trocada por outra decisão (com link).

## Formato de cada arquivo

1. Contexto: o problema e de onde veio o pedido.
2. Decisão: o que fazer, em regras verificáveis.
3. Modelo de dados e API, quando houver.
4. Diferenças em relação ao Wallefy e ao Minhas Economias.
5. Perguntas em aberto.
