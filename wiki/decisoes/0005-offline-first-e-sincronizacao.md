# 0005 — Offline-first e sincronização

> Status: Proposta · Última atualização: 2026-10-25

## Contexto

O Wallefy é offline-first: cada aparelho tem um SQLite local, que é "a fonte da verdade", replicado pelo Turso; os IDs são gerados no cliente, nada é apagado de verdade (`archived_at`) e conflitos são resolvidos pelo `updated_at` mais recente ([referência](../referencias/wallefy.md)). O Minhas Economias é só online.

Com wallets compartilhadas ([0002](0002-wallets-e-compartilhamento.md)), esse modelo tem quatro riscos:

1. **Edições perdidas:** se duas pessoas editam a mesma transação sem internet, "a mais recente vence" apaga a outra edição inteira, sem aviso.
2. **Relógios errados:** `updated_at` vem do relógio do aparelho; um celular com a hora adiantada sempre vence.
3. **Acesso revogado:** quem foi removido de uma wallet continua com os dados no aparelho e pode continuar lançando sem internet.
4. **Permissões:** um VIEWER sem internet não pode ser impedido só pelo servidor.

## Decisão

### O que funciona sem internet

| Funciona offline | Exige internet |
| --- | --- |
| Ver, criar, editar e arquivar lançamentos, contas, cartões, categorias, tags, recorrências, regras, orçamentos, objetivos, bens e membros da família das wallets em que a pessoa é membro | Login, cadastro, MFA, troca de senha ou e-mail |
| Relatórios e saldos calculados com os dados locais | Convites, aceite, mudança de papel, remoção, saída e transferência de posse de wallet |
| Criar wallet nova (sincroniza depois) | Arquivar wallet, apagar a conta |
| | Exportar dados, anexos (envio do arquivo) |

### Quem manda

1. **O servidor é a fonte da verdade.** O banco local é uma cópia de trabalho mais uma fila de alterações pendentes. Isso inverte o princípio do Wallefy.
2. O servidor valida toda alteração recebida: permissão do autor **no momento em que a alteração chega**, regras de negócio e pertencimento à wallet.
3. Valores derivados (saldo, fatura, progresso de objetivo) são calculados no aparelho para resposta imediata e recalculados pelo servidor, que prevalece.

### Fila de alterações (outbox)

Cada escrita local grava, na mesma transação, uma **mutação** na fila:

| Campo | Uso |
| --- | --- |
| `mutation_id` | UUID; torna o reenvio idempotente |
| `device_id` | Aparelho que gerou |
| `wallet_id`, `entity`, `entity_id` | O que mudou |
| `op` | `CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE` |
| `changes` | Só os campos alterados, com o valor novo |
| `base_version` | Versão do registro que o aparelho tinha ao editar |
| `occurred_at` | Hora do aparelho (só informativa, não decide conflito) |

IDs novos são UUIDv7, gerados no aparelho.

### Sincronização

1. **Enviar:** `POST /api/sync/push` com as mutações pendentes, em ordem. O servidor responde, para cada uma: `ACCEPTED` (com a nova versão), `CONFLICT` ou `REJECTED` (com o motivo).
2. **Receber:** `GET /api/sync/pull?wallet_id=&since=<seq>` devolve o que mudou desde a última sequência daquela wallet, em páginas.
3. Cada wallet tem uma **sequência crescente no servidor** (`server_seq`); cada registro tem uma `version` incrementada pelo servidor. A ordem real é a de chegada ao servidor, nunca o relógio do aparelho.
4. Gatilhos: abrir o app, voltar a ter internet, depois de cada escrita (com espera de alguns segundos) e a cada 5 minutos com o app aberto.
5. A tela mostra o estado: sincronizado, N alterações pendentes, ou conflitos para revisar.

### Conflitos

O servidor compara campo a campo: só há conflito se o **mesmo campo** foi alterado por outra pessoa depois da `base_version` do aparelho.

| Situação | Resultado |
| --- | --- |
| Campos diferentes alterados | Junta as duas edições |
| Mesmo campo de texto livre (descrição, notas), tags, categoria, membro | Vale a que chegou por último ao servidor; a outra fica no histórico ([0006](0006-auditoria.md)) |
| Mesmo campo crítico: valor, data, tipo, conta, cartão, moeda, parcelas | Fica o valor do servidor; a edição do aparelho vira um **conflito para revisar** |
| Uma pessoa editou e outra arquivou | Fica arquivado; a edição vira conflito para revisar |
| Registro arquivado recebe edição antiga | Rejeitada, com conflito para revisar |

Conflitos aparecem numa tela "Revisar conflitos" para quem fez a edição, com as duas versões lado a lado e as opções manter a do servidor ou aplicar a minha (que vira uma alteração nova, sujeita à permissão atual).

### Permissões e acesso revogado

- O app bloqueia na interface o que o papel não permite (ex.: VIEWER não edita), usando o papel recebido na última sincronização.
- O servidor rejeita (`REJECTED: forbidden`) qualquer mutação de quem não tem o papel necessário quando ela chega, mesmo que o aparelho achasse que tinha.
- Quando a pessoa perde o acesso, o próximo `pull` devolve a wallet em `revoked_wallets`; o app apaga do aparelho todos os dados daquela wallet e descarta as mutações pendentes dela, avisando o usuário.
- Sair da conta apaga o banco local.

### Dados no aparelho

- Banco local criptografado (SQLCipher no celular). No navegador, só se a web também for offline (pergunta em aberto).
- Token de sessão no armazenamento seguro do sistema (Keychain, Keystore).
- Bloqueio do app com PIN ou biometria, opcional.
- Um aparelho só sincroniza wallets em que o usuário é membro ativo; nada de outras wallets fica no aparelho.

### Exclusão e retenção

- Toda tabela sincronizada usa exclusão lógica (`archived_at`); o registro arquivado continua sendo enviado para os aparelhos saberem que saiu.
- Exclusão física só ao apagar a conta ou a wallet definitivamente, por obrigação de privacidade (LGPD/GDPR), feita no servidor.

### Recorrências sem duplicar

Ocorrências geradas de recorrências usam ID determinístico (UUIDv5 de `recurrence_id` + data). Assim, dois aparelhos offline que geram a mesma ocorrência produzem o mesmo ID, e o servidor não duplica. Isso evita o bug do Minhas Economias, onde a recorrência duplicou um gasto ([problemas-encontrados.md](../problemas-encontrados.md)).

### Versões do app

O `push` e o `pull` enviam a versão do esquema local. O servidor recusa versões antigas demais com um código que manda o app se atualizar antes de sincronizar.

## Modelo de dados

| Onde | Tabela | Campos principais |
| --- | --- | --- |
| Servidor | colunas em toda tabela sincronizada | `version`, `server_seq`, `updated_at`, `updated_by`, `archived_at` |
| Servidor | `devices` | `id`, `user_id`, `name`, `platform`, `schema_version`, `last_sync_at`, `revoked_at` |
| Servidor | `sync_mutations` | `mutation_id` (PK), `wallet_id`, `user_id`, `device_id`, `entity`, `entity_id`, `op`, `changes`, `base_version`, `occurred_at`, `received_at`, `status`, `reason`, `server_seq` |
| Servidor | `sync_conflicts` | `id`, `wallet_id`, `mutation_id`, `entity`, `entity_id`, `field`, `server_value`, `device_value`, `resolved_at`, `resolved_by`, `resolution` |
| Servidor | `wallet_sequences` | `wallet_id`, `last_seq` |
| Aparelho | `outbox` | Mutações pendentes, como acima, mais `attempts` e `last_error` |
| Aparelho | `sync_state` | `wallet_id`, `last_pulled_seq`, `role`, `last_sync_at` |

## Diferenças

- **Wallefy:** o aparelho é a fonte da verdade e vence pelo relógio; aqui o servidor decide pela ordem de chegada.
- **Wallefy:** a linha inteira vence; aqui a mescla é por campo, com conflitos visíveis para campos de dinheiro.
- **Wallefy:** não trata acesso revogado nem permissões offline.
- **Minhas Economias:** só online; não há o que comparar.

## Perguntas em aberto

- [ ] A versão web também funciona offline, ou só o app móvel?
- [ ] Qual tecnologia de sincronização: implementação própria (como acima), Turso com réplicas embarcadas como no Wallefy, ou uma biblioteca pronta (PowerSync, ElectricSQL)? A escolha muda quanto disto precisa ser construído.
- [ ] A política de conflitos por campo está boa, ou prefere que todo conflito vá para revisão?
- [ ] Criptografar o banco local é obrigatório desde a v1?
- [ ] Anexos ficam disponíveis offline (baixados no aparelho) ou só com internet?
