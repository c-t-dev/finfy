# 0002 — Wallets, papéis, compartilhamento e transferência de posse

> Status: Proposta · Última atualização: 2026-10-25

## Contexto

No Minhas Economias não existe compartilhamento: a Ajuda diz que a única forma é usar o mesmo login. O finfy precisa que cada usuário tenha várias wallets, compartilhe cada uma com outras pessoas em níveis de permissão diferentes e possa passar a posse de uma wallet para outra pessoa. O Wallefy já tem wallets e papéis, mas não tem transferência de posse (ver [referência](../referencias/wallefy.md)).

## Decisão

### Wallets

1. Um usuário pode ter quantas wallets quiser. No cadastro é criada uma wallet pessoal na moeda escolhida.
2. Todo dado financeiro pertence a uma wallet (`wallet_id`): contas, cartões, transações, categorias próprias, tags, recorrências, regras, orçamentos, objetivos, bens, membros da família.
3. Wallets são apagadas só de forma lógica (`archived_at`), pelo dono, com confirmação reforçada ([0004](0004-seguranca-da-conta.md)).

### Papéis

Cada pessoa com acesso tem uma linha em `wallet_members` com um papel. **A posse fica só ali** (papel `OWNER`), sem coluna `owner_id` duplicada na wallet.

| Ação | OWNER | ADMIN | EDITOR | VIEWER |
| --- | :---: | :---: | :---: | :---: |
| Ver lançamentos, contas e relatórios | ✓ | ✓ | ✓ | ✓ |
| Criar e editar lançamentos, contas, cartões, categorias | ✓ | ✓ | ✓ | ✗ |
| Apagar lançamentos | ✓ | ✓ | ✓ | ✗ |
| Editar nome e configurações da wallet | ✓ | ✓ | ✗ | ✗ |
| Convidar, remover e mudar papel de EDITOR e VIEWER | ✓ | ✓ | ✗ | ✗ |
| Convidar, remover e mudar papel de ADMIN | ✓ | ✗ | ✗ | ✗ |
| Transferir a posse | ✓ | ✗ | ✗ | ✗ |
| Arquivar a wallet | ✓ | ✗ | ✗ | ✗ |
| Sair da wallet | ✗ (precisa transferir antes) | ✓ | ✓ | ✓ |

Regras:

- Exatamente um `OWNER` ativo por wallet (índice único parcial em `wallet_id` onde `role = 'OWNER' AND removed_at IS NULL`).
- Ninguém altera o próprio papel nem um papel igual ou acima do seu.
- A permissão é verificada no servidor a cada pedido, consultando `wallet_members`. **Não** vai dentro do token de sessão (no Wallefy, quem perdia acesso continuava com ele até o JWT expirar).
- Toda mudança de papel, entrada e saída gera registro em `audit_logs` e e-mail para a pessoa afetada.

### Transferência de posse

Fluxo em dois passos, para ninguém receber uma wallet sem aceitar:

1. O dono escolhe um membro **já ativo** da wallet e confirma com senha ou segundo fator (step-up).
2. O sistema cria uma transferência pendente e manda e-mail ao destinatário (token de uso único, só o hash é guardado, válido 7 dias). O destinatário também vê o pedido no app.
3. O destinatário aceita, confirmando com o próprio segundo fator quando tiver MFA.
4. Numa única transação de banco: o destinatário vira `OWNER`; o dono anterior vira `ADMIN` (ou sai, se marcou essa opção no passo 1); a transferência é marcada como aceita.
5. Os dois recebem e-mail de confirmação; o evento vai para `audit_logs` e `security_events`.

Restrições: uma transferência pendente por wallet; o dono pode cancelar enquanto estiver pendente; o destinatário pode recusar; expira sozinha; mudar o papel ou remover o destinatário cancela a transferência; durante o pedido nada muda de acesso.

Para dar a wallet a quem ainda não é membro: convidar primeiro ([0003](0003-convites-por-email.md)) e transferir depois.

## Modelo de dados

| Tabela | Campos principais |
| --- | --- |
| `wallets` | `id`, `name`, `currency_code`, `currency_locked_at`, `created_by`, `archived_at`, `created_at`, `updated_at` |
| `wallet_members` | `id`, `wallet_id`, `user_id`, `role` (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`), `invited_by`, `joined_at`, `removed_at`, `removed_by`, `created_at`, `updated_at`; único (`wallet_id`, `user_id`) entre ativos |
| `wallet_ownership_transfers` | `id`, `wallet_id`, `from_user_id`, `to_user_id`, `previous_owner_action` (`STAY_ADMIN`, `LEAVE`), `token_hash`, `expires_at`, `accepted_at`, `declined_at`, `canceled_at`, `created_at` |
| `audit_logs` | `wallet_id`, `user_id`, `entity`, `entity_id`, `action`, `before`, `after`, `created_at` |

## API (proposta)

| Método | Rota | Quem |
| --- | --- | --- |
| GET | `/api/wallets` | Usuário: wallets onde é membro ativo, com o papel |
| POST | `/api/wallets` | Usuário |
| PATCH | `/api/wallets/:id` | OWNER, ADMIN |
| POST | `/api/wallets/:id/archive` | OWNER + step-up |
| GET | `/api/wallets/:id/members` | Todos os membros |
| PATCH | `/api/wallets/:id/members/:memberId` | Conforme a matriz |
| DELETE | `/api/wallets/:id/members/:memberId` | Conforme a matriz (remoção lógica) |
| POST | `/api/wallets/:id/leave` | Membro não dono |
| POST | `/api/wallets/:id/ownership-transfers` | OWNER + step-up |
| POST | `/api/ownership-transfers/:id/accept` | Destinatário (+ MFA se ativo) |
| POST | `/api/ownership-transfers/:id/decline` | Destinatário |
| POST | `/api/ownership-transfers/:id/cancel` | OWNER |

## O que já está implementado (2026-10-25)

Detalhes em [codebase.md → Wallets](../finfy/codebase.md#wallets).

| Implementado | Ainda não |
| --- | --- |
| Criar, listar e trocar de wallet; quem cria vira `OWNER` | Membros, convites, mudança de papel, sair da wallet |
| Renomear (OWNER, ADMIN) e trocar a moeda antes do primeiro lançamento | Transferência de posse |
| Arquivar (só OWNER), pedindo a senha de novo | Step-up com segundo fator (MFA ainda não existe) |
| Papel conferido no servidor a cada pedido; quem não é membro recebe 404 | E-mail para a pessoa afetada (sem provedor de e-mail) |

Diferença em relação ao item 1 da decisão: o cadastro **não** cria uma wallet automaticamente. O cadastro não pergunta a moeda, então a primeira wallet é criada pela tela inicial ("Crie sua primeira wallet").

## Diferenças

- **Wallefy:** três papéis; o finfy adiciona `ADMIN` para delegar a gestão de membros sem dar a posse.
- **Wallefy:** posse em dois lugares (`owner_id` e papel). O finfy usa só `wallet_members`.
- **Wallefy:** não tem transferência de posse nem saída da wallet.
- **Minhas Economias:** não tem compartilhamento; "Membros" são só rótulos. No finfy esses rótulos continuam existindo como `household_members`, separados de `wallet_members`.

## Perguntas em aberto

- [ ] Manter o papel `ADMIN` ou ficar só com OWNER, EDITOR e VIEWER como no Wallefy?
- [ ] EDITOR pode apagar lançamentos de outras pessoas, ou só os próprios?
- [ ] Na transferência, o dono anterior vira `ADMIN` por padrão ou escolhe sempre?
- [ ] Permitir transferir para alguém que ainda não é membro (convite + transferência num passo só)?
