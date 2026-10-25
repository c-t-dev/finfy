# Referência: Wallefy (projeto my-fin)

> Última atualização: 2026-10-25

O Wallefy é o projeto `my-fin` (repositório `c-t-dev/my-fin`, pasta `D:\projetos\my-fin`): Next.js, SQLite + Turso (offline-first), Drizzle, Argon2. O finfy reaproveita o desenho dele para wallets, convites e segurança, corrigindo as lacunas abaixo.

Fontes lidas: `docs/data-model.md`, `docs/architecture.md`, `docs/roadmap.md`, `docs/user-settings.md`, `src/core/db/schema/{auth,wallets}.ts`, `src/core/api/permissions.ts`, `src/app/api/auth/login/route.ts`.

## O que o Wallefy já tem

| Tema | Como está |
| --- | --- |
| Wallets | Tabela `wallets` com `owner_id` e `currency` (ISO 4217, padrão `EUR`). Todo dado financeiro tem `wallet_id`. |
| Moeda | `wallets.currency` é a moeda de relatório; `accounts.currency` pode ser outra. Valores em centavos inteiros. Sem câmbio no MVP. |
| Papéis | `wallet_members.role`: `OWNER`, `EDITOR`, `VIEWER`. Hierarquia numérica em `permissions.ts` (`requireWalletAccess`, `requireWalletEdit`, `requireWalletOwn`). |
| Matriz | Todos veem; OWNER e EDITOR criam e editam; só OWNER gerencia membros e apaga a wallet. |
| Convite para wallet | `wallet_invites` com `invited_email`, `role` (`EDITOR`/`VIEWER`), `token_hash` (SHA-256), `expires_at`, `accepted_at`. Só aceita quem autenticar com o mesmo e-mail. |
| Convite para o app | `user_invites` com token em hash, `accepted_by`, `revoked_at`. |
| Senha | Argon2id (biblioteca `argon2`), salt embutido no hash. |
| OTP | `otp_codes`: 6 dígitos em hash, tipos `LOGIN`, `EMAIL_VERIFY`, `TWO_FACTOR`, 5 min, 3 tentativas. |
| Sessões | `user_sessions` com `token_hash`, IP, user agent, `revoked_at`. |
| Reset de senha | `password_reset_tokens` com hash e `used_at`. |
| OAuth | `user_oauth_providers`: Google, Microsoft, Apple, GitHub. |
| Auditoria | `audit_logs` com antes e depois, por wallet. |
| Pessoas da família | `household_members` (rótulos, não usuários), separado de `wallet_members`. |

## Lacunas encontradas

| # | Lacuna | Evidência | Como o finfy trata |
| --- | --- | --- | --- |
| 1 | Transferir a posse de uma wallet não existe | Nenhuma ocorrência em código ou docs | [decisão 0002](../decisoes/0002-wallets-e-compartilhamento.md) |
| 2 | Pepper documentado, mas não aplicado | `argon2.hash(password)` sem segredo em `signup`, `login`, `change-password` | [decisão 0004](../decisoes/0004-seguranca-da-conta.md) |
| 3 | Posse duplicada: `wallets.owner_id` e papel `OWNER` em `wallet_members` | `getUserWalletRole` consulta os dois | Uma fonte só: `wallet_members` |
| 4 | Lista de wallets dentro do JWT de 7 dias | `generateTokens(user.id, walletIds)` no login | Permissão consultada a cada pedido; sessão opaca revogável |
| 5 | `user_sessions` não é usada no login | Login só gera JWT e refresh token | Sessão registrada e revogável |
| 6 | Sem limite de tentativas | `API_IMPLEMENTATION_GUIDE.md`: "Rate limiting (TODO)" | Limite por IP e por conta |
| 7 | 2FA só planejado | `user-settings.md`: "Implement 2FA" pendente | TOTP + códigos de recuperação + OTP por e-mail |
| 8 | Sem envio de e-mail | Nenhuma biblioteca de e-mail no `package.json` | Provedor a definir |
| 9 | Convite de wallet não pode ser revogado nem recusado | `wallet_invites` sem `revoked_at`/`declined_at` | Estados completos |
| 10 | Login com e-mail inexistente responde mais rápido | Retorna antes do `argon2.verify` | Verificar um hash falso para igualar o tempo |
| 11 | Cookie `userMetadata` legível pelo JavaScript com papéis | `httpOnly: false` | Papéis vêm de endpoint autenticado |
