# Decisões do finfy

> Última atualização: 2026-10-25

Cada decisão de produto ou arquitetura do finfy fica num arquivo próprio, numerado, para que qualquer agente saiba o que já foi decidido e por quê.

| # | Decisão | Status |
| --- | --- | --- |
| [0001](0001-multimoeda.md) | Várias moedas (EUR e BRL) | Proposta |
| [0002](0002-wallets-e-compartilhamento.md) | Wallets, papéis, compartilhamento e transferência de posse | Proposta |
| [0003](0003-convites-por-email.md) | Convites para wallets por e-mail | Proposta |
| [0004](0004-seguranca-da-conta.md) | Segurança da conta (senha, MFA, sessões) | Proposta |
| [0005](0005-offline-first-e-sincronizacao.md) | Offline-first e sincronização (servidor decide, mescla por campo, conflitos) | Proposta |
| [0006](0006-auditoria.md) | Auditoria por wallet (imutável, origem, diferença por campo) | Proposta |

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
