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

## Funcionalidades que o finfy ainda não decidiu

Recursos que existem no Wallefy (no código, na documentação ou nos wireframes em `docs/design/wallefy/project/Wallefy Wireframes.html`) e que ainda não têm decisão no finfy. O Minhas Economias não tem os marcados com ✱.

| Funcionalidade | Como está no Wallefy | Onde |
| --- | --- | --- |
| Offline-first com sincronização ✱ | SQLite local é a fonte da verdade; Turso replica; IDs gerados no cliente; apagar é sempre lógico (`archived_at`); conflito resolvido pelo `updated_at` mais recente | `CLAUDE.md`, `docs/architecture.md`, `POST /api/wallets/:id/sync` |
| Anexos em transações ✱ | `transaction_attachments` (arquivo em S3/R2, nome, tamanho, quem enviou) | `docs/data-model.md`, wireframe "Anexo" |
| Estornos ✱ | `transaction_links` do tipo `REFUND` liga a devolução à compra | `docs/data-model.md` |
| Ajuste de saldo | Transação `ADJUSTMENT` com valor com sinal, criada informando o saldo desejado | `POST /api/balance-adjustments` |
| Fatura de cartão completa | Faturas `OPEN`/`CLOSED`/`PAID`/`OVERDUE`, compra vai para a fatura pela data de fechamento, parcelas em faturas diferentes, pagamento integral gera `CREDIT_CARD_PAYMENT` | `credit_card_invoices`, `POST /api/invoices/:id/pay` |
| Orçamentos com nome ✱ | Vários orçamentos por wallet, cada um uma grade categoria × mês do ano | `budgets` + `budget_items`, telas `/budgets` |
| Notificações no app | Fatura vencendo, orçamento estourado, objetivo atingido, convite de wallet; lidas e não lidas | `notifications`, wireframe "Notificações" |
| Auditoria por wallet ✱ | Antes e depois de cada criação e edição, com quem fez | `audit_logs` |
| Relatórios e exportação | Resumo, saldos, fluxo de caixa; exportar transações em CSV | `/api/reports/*`, `GET /api/transactions/export` |
| Importar dados ✱ | Item "Importar dados" nas configurações (só no wireframe) | wireframe de configurações |
| Convite para o app | Convidar alguém para se cadastrar, sem wallet | `user_invites` |
| Idiomas e preferências | pt e en; categorias de sistema por chave de tradução; tema, moeda padrão, menu lateral fixo | `next-intl`, `users`, `docs/user-settings.md` |
| Regras simples com prioridade | Contém, igual ou começa com; ignora maiúsculas e acentos; menor prioridade roda primeiro; reaplicar | `categorization_rules`, `POST /api/rules/:id/apply` |
| Materializar recorrência | Gera a transação real de uma ocorrência | `POST /api/recurrences/:id/materialize` |
| Documentação da API | Swagger em `/docs`, gerado dos comentários | `next-swagger-doc` |
| App móvel e futuro | Capacitor depois da web; no futuro: criptografia de ponta a ponta, CRDT, colaboração em tempo real | `docs/roadmap.md` |

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
