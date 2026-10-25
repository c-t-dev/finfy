# 0006 — Auditoria

> Status: Proposta · Última atualização: 2026-10-25

## Contexto

Numa wallet compartilhada ([0002](0002-wallets-e-compartilhamento.md)) as pessoas precisam saber quem criou, alterou ou arquivou cada coisa, e quem entrou, saiu ou mudou de papel. Com edições offline ([0005](0005-offline-first-e-sincronizacao.md)), o histórico também é o lugar onde fica a edição que "perdeu" num conflito.

O Wallefy tem `audit_logs` com antes e depois em JSON, mas só para `CREATE` e `UPDATE`, sem origem da alteração, sem eventos de membros e sem garantia de que o registro não é alterado ([referência](../referencias/wallefy.md)). O Minhas Economias não tem histórico.

## Decisão

### O que é registrado

| Grupo | Eventos |
| --- | --- |
| Dados financeiros | `CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE` de transações, contas, cartões, faturas, categorias, tags, recorrências, regras, orçamentos, objetivos e depósitos, bens, membros da família, anexos |
| Wallet | Criação, renomear, mudar configurações, arquivar |
| Acesso | Convite enviado, reenviado, revogado, aceito, recusado; papel alterado; membro removido; membro saiu; transferência de posse pedida, aceita, recusada, cancelada |
| Dados em massa | Importação, exportação, reaplicação de regra |
| Sincronização | Conflito criado e resolvido |

Eventos da conta (login, senha, MFA, sessões) **não** entram aqui: ficam em `security_events`, por usuário ([0004](0004-seguranca-da-conta.md)).

### Como cada registro é feito

1. **Quem grava é o servidor**, na mesma transação de banco da alteração. O aparelho nunca escreve no histórico; edições offline são registradas quando sincronizam.
2. Cada registro guarda:
   - quem fez (`actor_user_id`) e de qual aparelho (`device_id`);
   - a **origem**: `APP`, `SYNC`, `RULE` (com o ID da regra), `RECURRENCE` (com o ID da recorrência), `IMPORT`, `SYSTEM`;
   - o que mudou, como diferença campo a campo (`{"amount_minor": {"from": 1250, "to": 1500}}`), não a linha inteira antes e depois;
   - quando aconteceu no aparelho (`occurred_at`) e quando chegou ao servidor (`recorded_at`);
   - o `mutation_id` da sincronização e um `correlation_id` para agrupar o que foi feito junto (ex.: as duas pernas de uma transferência, as parcelas de uma compra).
3. Campos derivados ou técnicos (`version`, `server_seq`, `updated_at`, campos desnormalizados) não entram na diferença.

### Imutável

- Só inserção: a API não tem rota para editar ou apagar registros de auditoria, e o banco bloqueia `UPDATE` e `DELETE` nessa tabela (permissão do usuário de banco ou gatilho).
- **Cadeia de hash por wallet:** cada registro guarda o hash do anterior (`prev_hash`) e o próprio (`hash` = SHA-256 do conteúdo + `prev_hash`). Uma verificação periódica refaz a cadeia e alerta se algo foi alterado por fora.

### Quem vê

Decidido em 2026-10-25: **todos os membros veem tudo.**

| Papel | Vê |
| --- | --- |
| OWNER, ADMIN, EDITOR, VIEWER | Histórico completo da wallet (feed de atividade, filtros, histórico de cada item, eventos de acesso) |
| OWNER, ADMIN | Além disso, exportação do histórico em CSV |
| Membro removido | Nada da wallet a partir da remoção |

### Na interface

- Detalhe de qualquer lançamento: aba "Histórico" com "Criado por Ana em 25/10 · Valor alterado de R$ 12,50 para R$ 15,00 por João (offline, sincronizado às 14:02)".
- Feed "Atividade" da wallet com filtros por pessoa, tipo de item, ação e período.
- "Restaurar" a partir de um registro de arquivamento (gera um `RESTORE`, sujeito à permissão atual).
- Alterações automáticas aparecem com a origem: "Categoria alterada pela regra Supermercados".

### Privacidade e retenção

- O histórico não guarda segredos (senhas, tokens, códigos) nem dados de outras wallets.
- Enquanto a wallet existir, o histórico fica completo. Wallet arquivada mantém o histórico.
- Quando uma pessoa apaga a conta, os registros dela continuam, mas o autor vira "Usuário removido" (pseudonimização), para cumprir LGPD/GDPR sem quebrar o histórico das outras pessoas.
- Apagar a wallet definitivamente apaga o histórico dela.

## Modelo de dados

`audit_logs`:

| Campo | Observação |
| --- | --- |
| `id` | UUIDv7 (ordenável) |
| `wallet_id` | |
| `actor_user_id` | Nulo para `SYSTEM`; pseudonimizado se a conta for apagada |
| `device_id` | Aparelho de origem, quando houver |
| `source` | `APP`, `SYNC`, `RULE`, `RECURRENCE`, `IMPORT`, `SYSTEM` |
| `source_ref_id` | ID da regra, recorrência ou importação |
| `action` | `CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`, `INVITE_SENT`, `MEMBER_ROLE_CHANGED`, `OWNERSHIP_TRANSFERRED`... |
| `entity`, `entity_id` | O que foi afetado |
| `changes` | JSON com a diferença por campo |
| `occurred_at`, `recorded_at` | Hora do aparelho e do servidor |
| `mutation_id`, `correlation_id` | Ligação com a sincronização e agrupamento |
| `prev_hash`, `hash` | Cadeia de integridade por wallet |

Índices: (`wallet_id`, `recorded_at`), (`entity`, `entity_id`), (`wallet_id`, `actor_user_id`).

## API (proposta)

| Método | Rota | Quem |
| --- | --- | --- |
| GET | `/api/wallets/:id/activity` | Todos os membros (feed, paginado) |
| GET | `/api/wallets/:id/audit?entity=&actor=&action=&from=&to=` | Todos os membros |
| GET | `/api/wallets/:id/audit/export` | OWNER, ADMIN (CSV) |
| GET | `/api/:entity/:id/history` | Quem pode ver o item |

## Diferenças

- **Wallefy:** só `CREATE`/`UPDATE`, antes e depois inteiros, sem origem, sem eventos de acesso, sem proteção contra alteração.
- **Minhas Economias:** sem histórico; não dá para saber quem mudou nem o que mudou.

## Perguntas em aberto

- [x] EDITOR e VIEWER veem o feed completo? **Sim, todos veem tudo** (decidido em 2026-10-25).
- [ ] A exportação em CSV fica só com OWNER e ADMIN (proposta) ou também é liberada para todos?
- [ ] A cadeia de hash é necessária na v1, ou basta bloquear edição no banco? Já está implementada (2026-10-25, custo baixo, ver [codebase.md → Write path](../finfy/codebase.md#write-path)); falta a verificação periódica. Pode ser retirada se decidirem que não precisa.
- [ ] Quanto tempo guardar o histórico: enquanto a wallet existir (proposta) ou um prazo fixo (ex.: 5 anos)?
