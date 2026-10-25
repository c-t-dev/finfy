# 0003 — Convites para wallets por e-mail

> Status: Proposta · Última atualização: 2026-10-25

## Contexto

O acesso a uma wallet compartilhada começa por um convite enviado por e-mail, para quem já tem conta e para quem ainda não tem. O Wallefy já desenhou esse fluxo (`wallet_invites`, token em hash, aceite só com o mesmo e-mail), mas sem revogar, recusar, reenviar nem enviar e-mail de fato ([referência](../referencias/wallefy.md)).

## Decisão

### Fluxo

1. OWNER ou ADMIN informa o e-mail e o papel (`ADMIN` só pelo OWNER; `EDITOR` ou `VIEWER` por ambos).
2. O servidor gera um token aleatório de 32 bytes, guarda só o SHA-256, define validade de 7 dias e envia o e-mail.
3. O e-mail diz quem convidou, o nome da wallet, o papel e a validade, com um botão para o link `/convite/<token>`.
4. Ao abrir o link:
   - Sem sessão: a página oferece entrar ou criar conta, com o e-mail convidado já preenchido e travado no cadastro.
   - Com sessão de outro e-mail: explica que o convite é para outro endereço e oferece trocar de conta. Nada é aceito.
   - Com sessão do mesmo e-mail **verificado**: mostra wallet, papel e quem convidou, com "Aceitar" e "Recusar".
5. Aceitar cria (ou reativa) a linha em `wallet_members` com o papel do convite e marca o convite como aceito, na mesma transação.
6. Quem convidou recebe e-mail e notificação no app com o resultado.

Se o e-mail já tem conta, o convite também aparece como notificação dentro do app, com os mesmos botões.

### Regras

- Token de uso único; convite aceito, recusado, revogado ou vencido não pode ser usado.
- Só aceita a conta cujo e-mail é igual ao convidado (comparação sem diferença de maiúsculas) e já verificado.
- Um convite pendente por (wallet, e-mail). Convidar de novo o mesmo e-mail é "reenviar": gera token novo, invalida o anterior e renova a validade.
- Quem convidou ou o OWNER pode revogar um convite pendente.
- A resposta da API ao convidar é igual exista ou não conta com aquele e-mail (não revela quem é usuário).
- Limites: até 20 convites por hora por wallet e 50 por dia por usuário; reenvio no máximo a cada 2 minutos para o mesmo e-mail.
- Convite para quem já é membro ativo é recusado com mensagem clara.
- Todo envio, aceite, recusa e revogação vai para `audit_logs`.

## Modelo de dados

`wallet_invites`: `id`, `wallet_id`, `invited_email` (normalizado em minúsculas), `role`, `invited_by`, `token_hash`, `expires_at`, `accepted_at`, `accepted_by`, `declined_at`, `revoked_at`, `revoked_by`, `last_sent_at`, `send_count`, `created_at`.

Estado derivado: `PENDING` (nenhuma data de término e não vencido), `ACCEPTED`, `DECLINED`, `REVOKED`, `EXPIRED`.

Envio de e-mail por uma fila (`email_outbox`: `id`, `to`, `template`, `payload`, `status`, `attempts`, `sent_at`, `error`) para não travar a requisição e permitir reenvio automático.

## API (proposta)

| Método | Rota | Quem |
| --- | --- | --- |
| GET | `/api/wallets/:id/invites` | OWNER, ADMIN |
| POST | `/api/wallets/:id/invites` | OWNER, ADMIN (envia ou reenvia) |
| POST | `/api/wallets/:id/invites/:inviteId/revoke` | Quem convidou ou OWNER |
| GET | `/api/invites/:token` | Público: dados mínimos (wallet, quem convidou, papel, validade) |
| POST | `/api/invites/:token/accept` | Usuário autenticado com o e-mail do convite |
| POST | `/api/invites/:token/decline` | Usuário autenticado com o e-mail do convite |
| GET | `/api/me/invites` | Convites pendentes para o e-mail do usuário |

## E-mails

| Modelo | Quando |
| --- | --- |
| `wallet-invite` | Convite enviado ou reenviado |
| `wallet-invite-accepted` / `wallet-invite-declined` | Para quem convidou |
| `wallet-role-changed` / `wallet-member-removed` | Para o membro afetado |
| `wallet-ownership-transfer-*` | Pedido, aceite, recusa e cancelamento da transferência ([0002](0002-wallets-e-compartilhamento.md)) |

Todos com o idioma do destinatário (pt-BR ou pt-PT/en conforme a conta; sem conta, o idioma de quem convidou).

## Perguntas em aberto

- [ ] Qual provedor de e-mail (Resend, Amazon SES, SMTP próprio)? E qual domínio remetente?
- [ ] Validade de 7 dias está boa?
- [ ] O convite para o app (sem wallet), que o Wallefy tem em `user_invites`, continua existindo no finfy?
