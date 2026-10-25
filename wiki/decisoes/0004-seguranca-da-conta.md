# 0004 — Segurança da conta

> Status: Proposta · Última atualização: 2026-10-25

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

## Diferenças

- **Wallefy:** pepper só no papel, JWT de 7 dias com wallets dentro, `user_sessions` sem uso, sem limites, sem TOTP nem códigos de recuperação. O finfy implementa tudo isso desde o início.
- **Minhas Economias:** login com Google, Apple ou e-mail e reCAPTCHA; a tela de Segurança só tem "Senha de login" e "Deletar conta"; sem MFA visível.

## Perguntas em aberto

- [ ] MFA obrigatório para OWNER e ADMIN de wallets compartilhadas, ou sempre opcional?
- [ ] Aceitar passkeys (WebAuthn) já na v1?
- [ ] Onde ficam os segredos em produção (variáveis do provedor de hospedagem, Vault, KMS)?
- [ ] Haverá app móvel offline? Isso define se usamos tokens rotativos além da sessão por cookie.
