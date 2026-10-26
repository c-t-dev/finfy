# 0004 — Segurança da conta

> Status: Proposta · Última atualização: 2026-10-26

## Contexto

O finfy guarda dados financeiros e permite compartilhar wallets, então a conta precisa nascer com proteções prontas: senha bem guardada, segundo fator, sessões revogáveis e limites contra força bruta. O Wallefy documenta Argon2id + pepper, OTP e sessões, mas o código não aplica o pepper, não usa a tabela de sessões e não tem limites nem 2FA ([referência](../referencias/wallefy.md)).

## Decisão

### Senhas

1. **Argon2id** com parâmetros explícitos e versionados: memória 64 MiB, 3 iterações, paralelismo 1 (acima do mínimo da OWASP de 19 MiB, 2 iterações).
2. **Salt:** 16 bytes aleatórios por senha, gerado pela biblioteca e embutido no hash (formato PHC `$argon2id$v=19$m=...$salt$hash`). Não precisa de coluna separada.
3. **Pepper:** antes do Argon2, a senha passa por HMAC-SHA256 com um segredo que fica fora do banco (variável de ambiente ou cofre de chaves). A coluna `pepper_version` permite trocar o pepper: no login seguinte com sucesso, a senha é refeita com a versão nova.
4. **Re-hash automático** no login quando os parâmetros ou o pepper mudarem.
5. **Política:** mínimo 12 caracteres, máximo 128, sem regras de composição; recusar senhas que aparecem em vazamentos (consulta k-anonymity ao Have I Been Pwned) e senhas iguais ao e-mail.
6. Trocar a senha exige a senha atual, encerra as outras sessões e manda e-mail de aviso.

### Segundo fator (MFA)

1. **TOTP** (RFC 6238, apps como Google Authenticator, 1Password): segredo de 20 bytes, códigos de 6 dígitos, janela de ±1 passo de 30 s; o mesmo passo não pode ser usado duas vezes (`last_used_step`).
2. O segredo TOTP é guardado **criptografado** (AES-256-GCM com chave fora do banco), nunca em texto puro, porque precisa ser lido para validar.
3. **Códigos de recuperação:** 10 códigos de uso único gerados ao ativar o MFA, mostrados uma vez e guardados só em hash.
4. **OTP por e-mail** (como no Wallefy): 6 dígitos em hash, 10 minutos, 5 tentativas, para verificar e-mail, login sem senha e como alternativa quando o usuário não tem TOTP.
5. MFA é opcional na v1, com convite para ativar ao entrar numa wallet compartilhada.

### Confirmação reforçada (step-up)

Ações sensíveis pedem a senha ou o segundo fator de novo, válido por 10 minutos:

trocar e-mail ou senha, ativar ou desativar MFA, gerar novos códigos de recuperação, transferir a posse de uma wallet, arquivar wallet, apagar a conta, encerrar todas as sessões.

### Sessões

1. Token opaco de 32 bytes num cookie `HttpOnly`, `Secure`, `SameSite=Lax`; no banco fica só o SHA-256 (`user_sessions`).
2. Expira por inatividade (30 dias) e por tempo absoluto (90 dias); renovado a cada uso.
3. Um token novo a cada login e a cada mudança de privilégio (MFA ativado, senha trocada).
4. Tela "Dispositivos conectados" com aparelho, local aproximado e último uso; encerrar um ou todos.
5. Papéis de wallet **não** vão no token; são consultados a cada pedido ([0002](0002-wallets-e-compartilhamento.md)).
6. Para o app móvel offline (se houver): token de acesso curto (15 min) + refresh token rotativo com detecção de reuso; reuso revoga a família inteira.

### Contra força bruta e enumeração

- Limite de tentativas de login por conta (5 falhas → espera crescente até 15 min) e por IP; o mesmo para OTP, TOTP, reset de senha e convites.
- Mensagens genéricas ("e-mail ou senha incorretos"); reset de senha e cadastro respondem igual exista ou não a conta.
- Quando o e-mail não existe, o login verifica um hash falso para o tempo de resposta ser igual.
- CAPTCHA só depois de várias falhas, não sempre.

### Verificação de e-mail e OAuth

- E-mail precisa estar verificado para aceitar convites, transferir ou receber wallets.
- Login com Google e Apple; uma conta OAuth só é ligada a uma conta existente se o provedor confirmar o e-mail como verificado e o usuário confirmar com a senha ou OTP.
- Tokens de acesso dos provedores não são guardados, a menos que algum recurso precise; se precisar, criptografados.

### Avisos e registro

- E-mail a cada: login em aparelho novo, troca de senha ou e-mail, MFA ativado ou desativado, códigos de recuperação usados, transferência de wallet.
- Tabela `security_events` com o tipo do evento, usuário, IP, user agent e data, visível ao usuário na tela de segurança.

## Modelo de dados

| Tabela | Campos principais |
| --- | --- |
| `users` | `email`, `email_verified_at`, `mfa_enabled_at`, `locked_until`, `failed_login_count` |
| `user_credentials` | `user_id`, `password_hash` (PHC), `pepper_version`, `password_changed_at` |
| `user_mfa_totp` | `user_id`, `secret_encrypted`, `key_version`, `confirmed_at`, `last_used_step` |
| `user_recovery_codes` | `user_id`, `code_hash`, `used_at` |
| `otp_codes` | `email`, `user_id`, `purpose`, `code_hash`, `expires_at`, `attempts`, `used_at` |
| `user_sessions` | `user_id`, `token_hash`, `ip`, `user_agent`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `step_up_until`, `revoked_at` |
| `password_reset_tokens` | `user_id`, `token_hash`, `expires_at` (30 min), `used_at` |
| `security_events` | `user_id`, `type`, `ip`, `user_agent`, `metadata`, `created_at` |
| `rate_limits` (ou Redis) | chave, janela, contagem |

## Segredos de configuração

`PASSWORD_PEPPER_V1` (e versões seguintes), `TOTP_ENCRYPTION_KEY_V1`, `SESSION_COOKIE_NAME`, chaves do provedor de e-mail. Nenhum vai para o repositório; `.env.example` lista só os nomes.

## O que já está implementado (2026-10-25)

Detalhes em [codebase.md → Authentication](../finfy/codebase.md#authentication).

| Implementado | Ainda não |
| --- | --- |
| Argon2id com os parâmetros desta decisão, pepper HMAC com versão e re-hash no login | TOTP, códigos de recuperação, step-up |
| Política de senha, incluindo a consulta ao Have I Been Pwned. Se a consulta falhar, o cadastro segue (falha aberta) | Troca e redefinição de senha |
| Cadastro, login e logout, sem passo de e-mail por enquanto (ver abaixo) | Tela "Dispositivos conectados", encerrar outras sessões |
| Sessão opaca em cookie, só o hash no banco, 30 dias de inatividade e 90 no total | Envio de e-mails: ficam na fila `email_outbox` até haver provedor |
| Bloqueio da conta e limites por IP e por e-mail (tabela `rate_limits`, no Postgres) | Avisos por e-mail de login novo e de mudanças |
| Login que não revela se o e-mail existe, incluindo o mesmo tempo de resposta | CAPTCHA após falhas, login com Google e Apple |
| Eventos em `security_events` | Tela de segurança para o usuário |

**Sem e-mail por enquanto (2026-10-25).** Não há provedor de e-mail, então nada que dependa de e-mail está ligado: código por e-mail (OTP), verificação do e-mail e avisos. O cadastro já entra direto no app, e o login não pede código. O código desse passo continua pronto e volta a funcionar quando houver provedor ([0003](0003-convites-por-email.md)); a chave é `EMAIL_DELIVERY_ENABLED` em `apps/web/lib/server/mail.ts`.

Consequência: enquanto o e-mail estiver desligado, o cadastro avisa quando o e-mail já tem conta (`emailTaken`). Isso revela se um e-mail está cadastrado, o que a regra contra enumeração queria evitar. Sem e-mail, não há outro jeito de avisar o dono da conta. O limite de 10 cadastros por hora por IP reduz o abuso. Com e-mail ligado, o cadastro volta a responder igual exista ou não a conta, e o login volta a exigir e-mail verificado.

### Cadastro por convite (decidido em 2026-10-26)

Com o finfy no ar para uso pessoal, o cadastro pode ser **fechado**: `SIGN_UP_MODE=invite` na Vercel (o padrão é `open`).

- Fechado, uma conta nova precisa de um **código de convite**. **Qualquer conta** gera códigos em Ajustes → "Convidar para o finfy". Assim, só entra quem foi convidado por alguém que já está dentro.
- O código é de **uso único** e vale **7 dias**. Tem 16 caracteres, no formato `XXXX-XXXX-XXXX-XXXX`, sem 0/O e 1/I/L. Pode ser digitado em minúsculas e sem traços.
- O código aparece uma vez só, com um link `/sign-up?code=…` que já preenche o campo. No banco fica só o SHA-256 (`signup_invites`).
- Cada conta tem no máximo 10 códigos esperando uso e gera até 20 por dia. Quem gerou pode cancelar um código ainda não usado, e vê quem usou cada um.
- O código é conferido **antes** do e-mail: sem um código válido, o cadastro não revela se um e-mail tem conta. O código é gasto na mesma transação que cria a conta.
- **A primeira conta** do sistema nunca precisa de código.
- Eventos: `SIGNUP_INVITE_CREATED`, `SIGNUP_INVITE_REVOKED`, `SIGN_UP_INVITE_INVALID`, e `SIGN_UP` guarda o `inviteId`.

## Diferenças

- **Wallefy:** pepper só no papel, JWT de 7 dias com wallets dentro, `user_sessions` sem uso, sem limites, sem TOTP nem códigos de recuperação. O finfy implementa tudo isso desde o início.
- **Minhas Economias:** login com Google, Apple ou e-mail e reCAPTCHA; a tela de Segurança só tem "Senha de login" e "Deletar conta"; sem MFA visível.

## Perguntas em aberto

- [ ] MFA obrigatório para OWNER e ADMIN de wallets compartilhadas, ou sempre opcional?
- [ ] Aceitar passkeys (WebAuthn) já na v1?
- [ ] Onde ficam os segredos em produção (variáveis do provedor de hospedagem, Vault, KMS)?
- [ ] Haverá app móvel offline? Isso define se usamos tokens rotativos além da sessão por cookie.
